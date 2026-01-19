package api

import (
	"log"
	"net/http"
	"sync"
	"time"

	"image-gen-service/internal/model"
	"image-gen-service/internal/worker"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
)

// wsNotifier 实现 worker.TaskNotifier 接口
type wsNotifier struct{}

func (n *wsNotifier) NotifyComplete(taskID string, task *model.Task) {
	NotifyTaskComplete(taskID, task)
}

func (n *wsNotifier) NotifyError(taskID string, errMsg string) {
	NotifyTaskError(taskID, errMsg)
}

func (n *wsNotifier) NotifyProgress(taskID string, completedCount, totalCount int, image interface{}) {
	NotifyTaskProgress(taskID, completedCount, totalCount, image)
}

// InitWSNotifier 初始化 WebSocket 通知器（在 main.go 中调用）
func InitWSNotifier() {
	worker.Notifier = &wsNotifier{}
	log.Println("[WebSocket] 通知器已注册")
}

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true // 允许所有来源，生产环境可以根据需求限制
	},
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
}

// TaskSubscriber 管理任务的 WebSocket 订阅者
type TaskSubscriber struct {
	mu          sync.RWMutex
	subscribers map[string]map[*websocket.Conn]bool // taskID -> connections
}

var taskSubscribers = &TaskSubscriber{
	subscribers: make(map[string]map[*websocket.Conn]bool),
}

// Subscribe 订阅任务更新
func (ts *TaskSubscriber) Subscribe(taskID string, conn *websocket.Conn) {
	ts.mu.Lock()
	defer ts.mu.Unlock()
	if ts.subscribers[taskID] == nil {
		ts.subscribers[taskID] = make(map[*websocket.Conn]bool)
	}
	ts.subscribers[taskID][conn] = true
}

// Unsubscribe 取消订阅
func (ts *TaskSubscriber) Unsubscribe(taskID string, conn *websocket.Conn) {
	ts.mu.Lock()
	defer ts.mu.Unlock()
	if conns, ok := ts.subscribers[taskID]; ok {
		delete(conns, conn)
		if len(conns) == 0 {
			delete(ts.subscribers, taskID)
		}
	}
}

// Broadcast 向任务的所有订阅者广播消息
func (ts *TaskSubscriber) Broadcast(taskID string, message interface{}) {
	ts.mu.RLock()
	conns := ts.subscribers[taskID]
	ts.mu.RUnlock()

	for conn := range conns {
		err := conn.WriteJSON(message)
		if err != nil {
			log.Printf("[WebSocket] 发送消息失败: %v", err)
			conn.Close()
			ts.Unsubscribe(taskID, conn)
		}
	}
}

// WSProgressMessage WebSocket 进度消息
type WSProgressMessage struct {
	Type           string      `json:"type"`           // "progress", "complete", "error"
	CompletedCount int         `json:"completedCount"` // 已完成数量
	TotalCount     int         `json:"totalCount"`     // 总数量
	LatestImage    interface{} `json:"latestImage"`    // 最新生成的图片信息
	Message        string      `json:"message"`        // 错误消息（仅 error 类型）
}

// GenerateWSHandler 处理生成任务的 WebSocket 连接
func GenerateWSHandler(c *gin.Context) {
	taskID := c.Param("task_id")
	if taskID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "task_id is required"})
		return
	}

	// 检查任务是否存在
	var task model.Task
	if err := model.DB.Where("task_id = ?", taskID).First(&task).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "task not found"})
		return
	}

	// 升级为 WebSocket 连接
	conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		log.Printf("[WebSocket] 升级连接失败: %v", err)
		return
	}
	defer conn.Close()

	log.Printf("[WebSocket] 客户端连接成功，任务ID: %s", taskID)

	// 订阅任务更新
	taskSubscribers.Subscribe(taskID, conn)
	defer taskSubscribers.Unsubscribe(taskID, conn)

	// 如果任务已经完成或失败，立即发送状态并关闭
	if task.Status == "completed" {
		conn.WriteJSON(WSProgressMessage{
			Type:           "complete",
			CompletedCount: task.TotalCount,
			TotalCount:     task.TotalCount,
			LatestImage:    buildImageInfo(&task),
		})
		return
	} else if task.Status == "failed" {
		conn.WriteJSON(WSProgressMessage{
			Type:    "error",
			Message: task.ErrorMessage,
		})
		return
	}

	// 启动轮询协程，监控任务状态变化
	ticker := time.NewTicker(1 * time.Second)
	defer ticker.Stop()

	lastStatus := task.Status
	lastCompletedAt := task.CompletedAt

	// 设置读取超时和 ping/pong
	conn.SetReadDeadline(time.Now().Add(60 * time.Second))
	conn.SetPongHandler(func(string) error {
		conn.SetReadDeadline(time.Now().Add(60 * time.Second))
		return nil
	})

	// 启动 ping 协程
	pingTicker := time.NewTicker(30 * time.Second)
	defer pingTicker.Stop()

	done := make(chan struct{})

	// 监听客户端消息（主要用于检测断开）
	go func() {
		defer close(done)
		for {
			_, _, err := conn.ReadMessage()
			if err != nil {
				if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
					log.Printf("[WebSocket] 连接异常关闭: %v", err)
				}
				return
			}
		}
	}()

	for {
		select {
		case <-done:
			log.Printf("[WebSocket] 客户端断开连接，任务ID: %s", taskID)
			return

		case <-pingTicker.C:
			if err := conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				log.Printf("[WebSocket] Ping 失败: %v", err)
				return
			}

		case <-ticker.C:
			// 查询最新任务状态
			var currentTask model.Task
			if err := model.DB.Where("task_id = ?", taskID).First(&currentTask).Error; err != nil {
				log.Printf("[WebSocket] 查询任务失败: %v", err)
				continue
			}

			// 检查状态是否变化
			statusChanged := currentTask.Status != lastStatus
			completedChanged := (currentTask.CompletedAt != nil && lastCompletedAt == nil) ||
				(currentTask.CompletedAt != nil && lastCompletedAt != nil && !currentTask.CompletedAt.Equal(*lastCompletedAt))

			if statusChanged || completedChanged {
				lastStatus = currentTask.Status
				lastCompletedAt = currentTask.CompletedAt

				switch currentTask.Status {
				case "completed":
					msg := WSProgressMessage{
						Type:           "complete",
						CompletedCount: currentTask.TotalCount,
						TotalCount:     currentTask.TotalCount,
						LatestImage:    buildImageInfo(&currentTask),
					}
					if err := conn.WriteJSON(msg); err != nil {
						log.Printf("[WebSocket] 发送完成消息失败: %v", err)
					}
					log.Printf("[WebSocket] 任务完成，关闭连接，任务ID: %s", taskID)
					return

				case "failed":
					msg := WSProgressMessage{
						Type:    "error",
						Message: currentTask.ErrorMessage,
					}
					if err := conn.WriteJSON(msg); err != nil {
						log.Printf("[WebSocket] 发送错误消息失败: %v", err)
					}
					log.Printf("[WebSocket] 任务失败，关闭连接，任务ID: %s", taskID)
					return

				case "processing":
					// 发送进度更新
					msg := WSProgressMessage{
						Type:           "progress",
						CompletedCount: 0, // 单任务模式，处理中为0
						TotalCount:     currentTask.TotalCount,
					}
					if err := conn.WriteJSON(msg); err != nil {
						log.Printf("[WebSocket] 发送进度消息失败: %v", err)
						return
					}
				}
			}
		}
	}
}

// buildImageInfo 构建图片信息用于 WebSocket 消息
func buildImageInfo(task *model.Task) map[string]interface{} {
	if task.LocalPath == "" && task.ImageURL == "" {
		return nil
	}
	return map[string]interface{}{
		"id":            task.TaskID,
		"taskId":        task.TaskID,
		"filePath":      task.LocalPath,
		"thumbnailPath": task.ThumbnailPath,
		"imageUrl":      task.ImageURL,
		"thumbnailUrl":  task.ThumbnailURL,
		"width":         task.Width,
		"height":        task.Height,
		"status":        "success",
	}
}

// NotifyTaskProgress 通知任务进度（供 worker 调用）
func NotifyTaskProgress(taskID string, completedCount, totalCount int, image interface{}) {
	taskSubscribers.Broadcast(taskID, WSProgressMessage{
		Type:           "progress",
		CompletedCount: completedCount,
		TotalCount:     totalCount,
		LatestImage:    image,
	})
}

// NotifyTaskComplete 通知任务完成（供 worker 调用）
func NotifyTaskComplete(taskID string, task *model.Task) {
	taskSubscribers.Broadcast(taskID, WSProgressMessage{
		Type:           "complete",
		CompletedCount: task.TotalCount,
		TotalCount:     task.TotalCount,
		LatestImage:    buildImageInfo(task),
	})
}

// NotifyTaskError 通知任务失败（供 worker 调用）
func NotifyTaskError(taskID string, errMsg string) {
	taskSubscribers.Broadcast(taskID, WSProgressMessage{
		Type:    "error",
		Message: errMsg,
	})
}
