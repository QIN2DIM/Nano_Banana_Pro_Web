import React, { useState, useEffect } from 'react';
import { Loader2, Languages } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useConfigStore } from '../../store/configStore';
import { Select } from '../../components/common/Select';
import { Modal } from '../../components/common/Modal';
import { getProviders, ProviderConfig } from '../../services/providerApi';
import { toast } from '../../store/toastStore';
import i18n, { DEFAULT_LANGUAGE } from '../../i18n';
import { getSystemLocale } from '../../i18n/systemLocale';

type SettingsTab = 'language';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const getDefaultModelId = (models?: string): string => {
  if (!models) return '';
  try {
    const parsed = typeof models === 'string' ? JSON.parse(models) : models;
    if (!Array.isArray(parsed)) return '';
    const preferred = parsed.find((item) => item && item.default && typeof item.id === 'string');
    if (preferred?.id) return preferred.id;
    const fallback = parsed.find((item) => item && typeof item.id === 'string');
    return fallback?.id || '';
  } catch {
    return '';
  }
};

const resolveSystemLanguage = (locale: string | null) => {
  if (!locale) return DEFAULT_LANGUAGE;
  const lower = locale.toLowerCase();
  if (lower.startsWith('zh')) return 'zh-CN';
  if (lower.startsWith('ja')) return 'ja-JP';
  if (lower.startsWith('ko')) return 'ko-KR';
  if (lower.startsWith('en')) return 'en-US';
  return 'en-US';
};

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const { t } = useTranslation();
  const {
    imageProvider, setImageProvider,
    setImageApiKey,
    setImageApiBaseUrl,
    setImageModel,
    chatProvider,
    setChatApiBaseUrl,
    setChatApiKey,
    setChatModel,
    setChatSyncedConfig,
    language,
    languageResolved,
    setLanguage,
    setLanguageResolved
  } = useConfigStore();

  const [activeTab, setActiveTab] = useState<SettingsTab>('language');
  const [fetching, setFetching] = useState(false);

  // 当弹窗打开时，从后端获取最新的配置（保持后台同步，但不显示设置项）
  useEffect(() => {
    if (isOpen) {
      setActiveTab('language');
      fetchConfigs();
    }
  }, [isOpen]);

  const fetchConfigs = async () => {
    setFetching(true);
    try {
      const data = await getProviders();

      const imageConfig = data.find((p) => p.provider_name === imageProvider);
      if (imageConfig) {
        setImageApiBaseUrl(imageConfig.api_base);
        setImageApiKey(imageConfig.api_key);
        const modelFromConfig = getDefaultModelId(imageConfig.models);
        if (modelFromConfig) {
          setImageModel(modelFromConfig);
        }
      }

      const chatConfig = data.find((p) => p.provider_name === chatProvider);
      if (chatConfig) {
        setChatApiBaseUrl(chatConfig.api_base);
        setChatApiKey(chatConfig.api_key);
        const modelFromConfig = getDefaultModelId(chatConfig.models);
        if (modelFromConfig) {
          setChatModel(modelFromConfig);
        }
        setChatSyncedConfig({
          apiBaseUrl: chatConfig.api_base || '',
          apiKey: chatConfig.api_key || '',
          model: modelFromConfig || ''
        });
      }
    } catch (error) {
      console.error('Failed to fetch config:', error);
      toast.error(t('settings.toast.fetchFailed'));
    } finally {
      setFetching(false);
    }
  };

  const handleLanguageChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const nextLanguage = e.target.value;
    if (nextLanguage === 'system') {
      setLanguage('system');
      const systemLocale = await getSystemLocale();
      const resolved = resolveSystemLanguage(systemLocale);
      setLanguageResolved(resolved);
      if (i18n.language !== resolved) {
        void i18n.changeLanguage(resolved);
      }
      return;
    }

    setLanguage(nextLanguage);
    if (languageResolved) {
      setLanguageResolved(null);
    }
    if (i18n.language !== nextLanguage) {
      void i18n.changeLanguage(nextLanguage);
    }
  };

  const tabClass = (tab: SettingsTab) => {
    const isActive = activeTab === tab;
    return [
      'w-full flex items-center gap-2 rounded-2xl px-3 py-2 text-sm font-semibold transition-all',
      isActive ? 'bg-slate-900 text-white shadow-sm' : 'bg-white/70 text-slate-600 hover:bg-white'
    ].join(' ');
  };

  const menuItems = [
    { id: 'language' as const, label: t('settings.language.label'), icon: Languages }
  ];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('settings.title')}
      className="max-w-4xl h-[78vh]"
      density="compact"
      contentScrollable={false}
      contentClassName="h-full min-h-0"
    >
      <div className="relative h-full min-h-0">
        <div className="grid grid-cols-[220px_minmax(0,1fr)] gap-8 h-full min-h-0">
          <div className="space-y-2">
            {menuItems.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                  className={tabClass(item.id)}
                  aria-pressed={activeTab === item.id}
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>

          <div className="flex flex-col gap-6 min-w-0 h-full min-h-0 relative">
            {fetching && (
              <div className="absolute inset-0 bg-white/60 z-10 flex items-center justify-center rounded-3xl backdrop-blur-[1px]">
                <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
              </div>
            )}
            <div className="space-y-5 flex-1 min-h-0 overflow-y-auto pr-2">
              {activeTab === 'language' && (
                <div className="space-y-3">
                  <label className="text-[13px] font-bold text-slate-700 uppercase tracking-wide flex items-center gap-2 px-1">
                    <Languages className="w-4 h-4 text-blue-600" />
                    {t('settings.language.label')}
                  </label>
                  <Select
                    value={language || i18n.language}
                    onChange={handleLanguageChange}
                    className="h-10 bg-slate-100 text-slate-900 font-bold rounded-2xl text-sm px-5 focus:bg-white border border-slate-200 transition-all shadow-none"
                  >
                    <option value="system">{t('language.system')}</option>
                    <option value="zh-CN">{t('language.zhCN')}</option>
                    <option value="en-US">{t('language.enUS')}</option>
                    <option value="ja-JP">{t('language.jaJP')}</option>
                    <option value="ko-KR">{t('language.koKR')}</option>
                  </Select>
                  <p className="text-xs text-slate-500 px-1">
                    {t('settings.language.hint')}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}
