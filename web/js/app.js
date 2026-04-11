/**
 * Vibro — Main App
 * Loads model/meta.json for dynamic UI: confusion matrix, metrics, importances.
 */

const App = (() => {
  let currentStop = null, diagLocked = false, currentSignalData = null;
  let meta = null; // loaded from meta.json
  let currentInputContext = { type: 'demo', label: 'Demo signal' };
  let currentDiagnosis = null;
  let currentSourceFile = null;
  let authState = null;
  let sessionHistory = [];
  let assetRegistry = [];
  let measurementRegistry = [];
  let reportRegistry = [];
  let apiReady = false;
  let dashboardSummary = null;
  let selectedAssetId = null;
  let compareBaselineId = null;
  let compareTargetId = null;
  let analysisCompareAssetId = null;
  let analysisCompareMode = 'baseline_current';
  let analysisCompareReferenceId = null;
  let analysisCompareTargetId = '__current';
  let selectedReportInspectionId = null;
  let assetSearchQuery = '';
  let assetStatusFilter = 'all';
  let assetRiskFilter = 'all';
  let assetSortMode = 'priority';
  const ASSET_VERSION = '20260411-demo-simplify-12';
  const STORAGE_KEYS = {
    legacyAuth: 'vm_local_auth_v1',
    legacySessions: 'vm_local_sessions_v1',
    legacyImportDone: 'vm_server_import_done_v1',
  };
  const API_BASE = '/api';
  const STORAGE_LIMITS = {
    sessions: 24,
    signalSamples: 4096,
  };
  const STATE_ALIASES = {
    baseline: 'healthy',
    healthy: 'healthy',
    monitor: 'warning',
    inspect: 'warning',
    warning: 'warning',
    critical: 'warning',
    service: 'service',
    after_maintenance: 'after_maintenance',
  };
  const SESSION_STATES = {
    healthy: { label: 'Healthy', tone: 'good', note: 'Эталонное или восстановленное состояние узла.' },
    warning: { label: 'Warning', tone: 'warning', note: 'Есть признаки деградации, нужен контроль и сравнение в динамике.' },
    service: { label: 'Service', tone: 'warning', note: 'Узел находится в сервисном цикле или требует ремонта.' },
    after_maintenance: { label: 'After maintenance', tone: 'good', note: 'Состояние после обслуживания или замены, используется для проверки эффекта ремонта.' },
  };
  const WORK_STATUSES = {
    observe: { label: 'Наблюдать', tone: 'good', note: 'Продолжить мониторинг и повторный замер по графику.' },
    inspect: { label: 'Проверить', tone: 'warning', note: 'Нужен дополнительный осмотр или повторная диагностика.' },
    repair: { label: 'Ремонт', tone: 'warning', note: 'Оборудование отправлено в обслуживание или ремонт.' },
    replaced: { label: 'Заменено', tone: 'good', note: 'Дефектный узел заменён или восстановлен.' },
  };
  const RISK_LEVELS = {
    low: { key: 'low', label: 'Low risk', tone: 'good', note: 'Базовое или восстановленное состояние узла.' },
    medium: { key: 'medium', label: 'Medium risk', tone: 'warning', note: 'Есть признаки деградации, но ситуация ещё контролируема.' },
    high: { key: 'high', label: 'High risk', tone: 'warning', note: 'Нужен ремонт или сокращение интервала эксплуатации.' },
    critical: { key: 'critical', label: 'Critical risk', tone: 'critical', note: 'Требуется немедленное вмешательство и жёсткий контроль.' },
  };
  const PLAYBOOK = {
    normal: {
      tone: 'good',
      badge: 'БАЗОВЫЙ СИГНАЛ',
      severity: 'Низкий риск',
      action: 'Оборудование можно оставить в работе и использовать сигнал как эталон для будущих сравнений.',
      reason: 'Сигнал чистый, без аномальных ударов и выраженных боковых полос вокруг рабочих гармоник.',
      short: 'Использовать как baseline для сравнения с дефектными кейсами.',
      priority: 'Продолжить мониторинг по графику',
    },
    tooth_chip: {
      tone: 'warning',
      badge: 'РАННИЙ ДЕФЕКТ',
      severity: 'Средний риск',
      action: 'Запланировать инспекцию зубчатой пары на ближайшее окно ТО и проверить динамику нагрузки.',
      reason: 'Есть ударные события и боковые полосы вокруг GMF, характерные для локального повреждения зуба.',
      short: 'Хороший кейс для демонстрации раннего обнаружения gear fault.',
      priority: 'Осмотр в ближайший сервисный интервал',
    },
    tooth_miss: {
      tone: 'critical',
      badge: 'КРИТИЧЕСКИЙ ДЕФЕКТ',
      severity: 'Критический риск',
      action: 'Остановить оборудование, проверить зубчатую пару и не возвращать узел в работу без осмотра.',
      reason: 'Наблюдаются сильные импульсы, разлом структуры GMF и высокий риск быстрого разрушения зацепления.',
      short: 'Максимальный вау-эффект: критический кейс с очевидным action item.',
      priority: 'Немедленное вмешательство',
    },
    root_crack: {
      tone: 'critical',
      badge: 'ВЫСОКИЙ РИСК',
      severity: 'Высокий риск',
      action: 'Сократить интервал эксплуатации до инспекции и проверить корень зуба на развитие трещины.',
      reason: 'Модуляция амплитуды и характерная бокополосная структура указывают на развивающееся разрушение.',
      short: 'Показывает, как модель ловит дефект до катастрофического отказа.',
      priority: 'Инспекция в кратчайший срок',
    },
    surface_wear: {
      tone: 'warning',
      badge: 'ТРЕБУЕТ КОНТРОЛЯ',
      severity: 'Повышенный риск',
      action: 'Проверить смазку, нагрузочный профиль и износ контактной поверхности до следующего цикла работы.',
      reason: 'Растёт широкополосный шум и высокочастотная энергия, что характерно для износа поверхности.',
      short: 'Подходит для демонстрации сценария профилактического обслуживания, а не аварийной остановки.',
      priority: 'Плановое обслуживание',
    },
    ball_fault: {
      tone: 'warning',
      badge: 'ПОДШИПНИК',
      severity: 'Повышенный риск',
      action: 'Проверить состояние подшипника и динамику роста defect frequency на следующем замере.',
      reason: 'Есть периодические ударные события и рост энергии в зоне BSF.',
      short: 'Подчёркивает, что продукт умеет отличать bearing issues от gear fault.',
      priority: 'Повторный замер и осмотр',
    },
    inner_race: {
      tone: 'critical',
      badge: 'ВЫСОКИЙ РИСК',
      severity: 'Высокий риск',
      action: 'Сократить время до обслуживания и проверить внутреннюю обойму подшипника под нагрузкой.',
      reason: 'Частые импульсы и энергия вокруг BPFI указывают на развивающийся дефект внутренней обоймы.',
      short: 'Показывает, что система различает дефекты подшипников и зубчатых передач.',
      priority: 'Ускоренное обслуживание',
    },
    outer_race: {
      tone: 'warning',
      badge: 'ТРЕБУЕТ ОСМОТРА',
      severity: 'Средний риск',
      action: 'Осмотреть подшипник и повторить измерение, чтобы оценить скорость деградации наружной обоймы.',
      reason: 'Спектр показывает устойчивые импульсные компоненты и рост энергии около BPFO.',
      short: 'Показывает уверенный bearing diagnosis с понятной локализацией.',
      priority: 'Осмотр в ближайшее время',
    },
    combination: {
      tone: 'critical',
      badge: 'СЛОЖНЫЙ СЛУЧАЙ',
      severity: 'Комплексный риск',
      action: 'Эскалировать кейс инженеру-диагносту: вероятно развивается несколько повреждений одновременно.',
      reason: 'В сигнале и спектре наложены несколько характерных паттернов, что увеличивает неопределённость и риск.',
      short: 'Сильный сценарий для разговора о сложных и дорогостоящих поломках.',
      priority: 'Расширенная диагностика узла',
    },
  };
  authState = normalizeAuth(null);
  sessionHistory = [];

  function getPlaybook(cls) {
    return PLAYBOOK[cls] || {
      tone: 'warning',
      badge: 'REVIEW',
      severity: 'Требуется проверка',
      action: 'Сохранить кейс и передать инженеру на дополнительный анализ.',
      reason: 'Система обнаружила отклонение, но для точной интерпретации нужен дополнительный контекст.',
      short: 'Требуется инженерная верификация результата.',
      priority: 'Ручной review',
    };
  }

  function trimText(value) {
    return String(value || '').trim();
  }

  function readStorage(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      console.warn('[APP] Storage read failed:', key, e);
      return fallback;
    }
  }

  function writeStorage(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) {
      console.warn('[APP] Storage write failed:', key, e);
      return false;
    }
  }

  function normalizeAuth(auth) {
    const next = auth && typeof auth === 'object' ? auth : {};
    return {
      id: trimText(next.id),
      email: trimText(next.email),
      name: trimText(next.name || next.display_name),
      role: trimText(next.role),
      signedInAt: next.signedInAt || next.created_at || null,
      sessionId: trimText(next.sessionId || next.session_id),
      sessionExpiresAt: next.sessionExpiresAt || next.session_expires_at || null,
    };
  }

  function normalizeStateKey(key) {
    return STATE_ALIASES[trimText(key)] || 'warning';
  }

  function inferWorkStatus(item, stateKey) {
    const explicit = trimText(item.workStatus || item.work_status);
    if (explicit && WORK_STATUSES[explicit]) return explicit;
    if (stateKey === 'service') return 'repair';
    if (stateKey === 'after_maintenance') return 'replaced';
    if (stateKey === 'warning') return 'inspect';
    return 'observe';
  }

  function normalizeAssets(list) {
    if (!Array.isArray(list)) return [];
    return list
      .filter(item => item && item.id)
      .map((item) => ({
        ...item,
        currentStatus: normalizeStateKey(item.currentStatus || item.current_status),
        location: trimText(item.location),
        description: trimText(item.description),
      }));
  }

  function normalizeReports(list) {
    if (!Array.isArray(list)) return [];
    return list
      .filter(item => item && item.id)
      .map((item) => ({
        ...item,
        inspectionId: item.inspectionId || item.inspection_id,
        shareUrl: item.shareUrl || item.share_url || null,
        shareToken: item.shareToken || item.share_token || null,
        payload: item.payload || {},
      }));
  }

  function normalizeMeasurements(list) {
    if (!Array.isArray(list)) return [];
    return list
      .filter(item => item && item.id)
      .map((item) => ({
        ...item,
        assetId: item.assetId || item.asset_id || null,
        assetName: item.assetName || item.asset_name || 'Не указан объект',
        inspectionId: item.inspectionId || item.inspection_id || null,
        sourceKind: item.sourceKind || item.source_kind || 'uploaded_file',
        sourceLabel: item.sourceLabel || item.source_label || 'Real monitoring',
        inputLabel: item.inputLabel || item.input_label || item.original_name || 'Measurement',
        originalName: item.originalName || item.original_name || 'signal.dat',
        fileExt: item.fileExt || item.file_ext || '',
        mimeType: item.mimeType || item.mime_type || '',
        storageSize: item.storageSize || item.storage_size || 0,
        sampleRate: item.sampleRate || item.sample_rate || VM.FS,
        sampleCount: item.sampleCount || item.sample_count || 0,
        durationSeconds: item.durationSeconds || item.duration_seconds || 0,
        predictedClass: item.predictedClass || item.predicted_class || null,
        confidence: item.confidence || 0,
        probabilities: item.probabilities || {},
        inputContext: item.inputContext || item.input_context || {},
        previewSignal: item.previewSignal || item.preview_signal || [],
        note: item.note || '',
        downloadUrl: item.downloadUrl || item.download_url || null,
        createdAt: item.createdAt || item.created_at || null,
        updatedAt: item.updatedAt || item.updated_at || null,
      }))
      .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
  }

  function normalizeHistory(list) {
    if (!Array.isArray(list)) return [];
    return list
      .filter(item => item && item.id)
      .map((item) => {
        const stateKey = normalizeStateKey(item.stateKey || item.state_key);
        const workStatus = inferWorkStatus(item, stateKey);
        const input = {
          ...(item.input || item.input_context || {}),
          label: item.input?.label || item.input_label || item.input_context?.label || 'Сохранённый сеанс',
          type: item.input?.type || item.input_type || item.input_context?.type || 'saved',
        };
        return {
          ...item,
          assetId: item.assetId || item.asset_id || null,
          measurementId: item.measurementId || item.measurement_id || input.measurementId || item.input_context?.measurementId || null,
          assetName: item.assetName || item.asset_name || 'Не указан объект',
          cls: item.cls || item.predicted_class,
          savedAt: item.savedAt || item.created_at,
          input,
          playbook: item.playbook || {},
          signalData: item.signalData || item.signal_data || [],
          sampleRate: item.sampleRate || item.sample_rate || VM.FS,
          stateKey,
          stateLabel: item.stateLabel || item.state_label || SESSION_STATES[stateKey]?.label || '',
          workStatus,
          workStatusLabel: item.workStatusLabel || item.work_status_label || WORK_STATUSES[workStatus]?.label || '',
          isBaseline: item.isBaseline === true || item.is_baseline === true,
          engineerReason: item.engineerReason || item.engineer_reason || '',
          actionTaken: item.actionTaken || item.action_taken || '',
        };
      })
      .slice(0, STORAGE_LIMITS.sessions);
  }

  function hasLegacySessions() {
    return normalizeHistory(readStorage(STORAGE_KEYS.legacySessions, [])).length > 0;
  }

  function isLegacyImportDone() {
    return readStorage(STORAGE_KEYS.legacyImportDone, false) === true;
  }

  function markLegacyImportDone() {
    return writeStorage(STORAGE_KEYS.legacyImportDone, true);
  }

  async function apiRequest(path, options = {}) {
    const headers = new Headers(options.headers || {});
    if (!headers.has('Content-Type') && options.body) headers.set('Content-Type', 'application/json');
    const response = await fetch(`${API_BASE}${path}`, {
      credentials: 'include',
      ...options,
      headers,
    });
    const text = await response.text();
    const payload = text ? (() => {
      try { return JSON.parse(text); } catch (e) { return text; }
    })() : null;
    if (!response.ok) {
      const detail = typeof payload === 'object' && payload ? payload.detail || payload.message : payload;
      throw new Error(detail || `API request failed: ${response.status}`);
    }
    return payload;
  }

  async function loadAuthState() {
    try {
      const payload = await apiRequest('/auth/me');
      authState = normalizeAuth({
        ...payload.user,
        session_id: payload.session?.id,
        session_expires_at: payload.session?.expires_at,
      });
      return authState;
    } catch (e) {
      authState = normalizeAuth(null);
      return null;
    }
  }

  async function loadHistory() {
    if (!authState?.id) {
      sessionHistory = [];
      assetRegistry = [];
      measurementRegistry = [];
      reportRegistry = [];
      dashboardSummary = null;
      syncWorkspaceSelection();
      renderWorkspace();
      return [];
    }
    const [history, summary, assets, reports, measurements] = await Promise.all([
      apiRequest('/inspections'),
      apiRequest('/dashboard/summary'),
      apiRequest('/assets'),
      apiRequest('/reports'),
      apiRequest('/measurements'),
    ]);
    sessionHistory = normalizeHistory(history);
    assetRegistry = normalizeAssets(assets);
    measurementRegistry = normalizeMeasurements(measurements);
    reportRegistry = normalizeReports(reports);
    dashboardSummary = summary;
    syncWorkspaceSelection();
    renderAuthSummary();
    renderWorkspace();
    return sessionHistory;
  }

  function legacySessionToApiItem(item) {
    const stateKey = normalizeStateKey(item.stateKey || 'warning');
    const stateMeta = getSessionStateMeta(stateKey);
    const workStatus = inferWorkStatus(item, stateKey);
    return {
      asset_name: item.assetName || 'Не указан объект',
      title: item.title || null,
      state_key: stateKey,
      state_label: stateMeta.label,
      work_status: workStatus,
      work_status_label: getWorkStatusMeta(workStatus).label,
      is_baseline: item.isBaseline === true || item.is_baseline === true,
      note: item.note || '',
      engineer_reason: item.engineerReason || '',
      action_taken: item.actionTaken || '',
      predicted_class: item.cls,
      confidence: item.confidence || 0,
      source_label: item.sourceLabel || 'Browser inference',
      input_type: item.input?.type || 'demo',
      input_label: item.input?.label || 'Legacy import',
      sample_rate: item.sampleRate || VM.FS,
      probabilities: item.probabilities || {},
      playbook: item.playbook || {},
      input_context: item.input || {},
      signal_data: Array.isArray(item.signalData) ? item.signalData : [],
      created_at: item.savedAt || null,
    };
  }

  async function importLegacySessions() {
    if (!authState?.id) {
      toast('Нужен вход', 'Сначала войдите в аккаунт, затем импортируйте локальный журнал.', 'warning');
      return;
    }
    const legacyItems = normalizeHistory(readStorage(STORAGE_KEYS.legacySessions, []));
    if (!legacyItems.length) {
      toast('Нечего переносить', 'В localStorage не найдено старых сохранённых сеансов.', 'info');
      return;
    }
    const payload = { items: legacyItems.map(legacySessionToApiItem) };
    const result = await apiRequest('/migrations/import-local-history', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    markLegacyImportDone();
    await loadHistory();
    toast('Импорт завершён', `Перенесено ${result.imported_count} сеансов и ${result.asset_count} связанных записей.`, 'success');
  }

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function formatStamp(value) {
    try {
      return new Intl.DateTimeFormat('ru-RU', {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(new Date(value));
    } catch (e) {
      return value || '—';
    }
  }

  function getSessionStateMeta(key) {
    return SESSION_STATES[normalizeStateKey(key)] || SESSION_STATES.warning;
  }

  function getWorkStatusMeta(key) {
    return WORK_STATUSES[trimText(key)] || WORK_STATUSES.observe;
  }

  function getRiskMeta(session, fallbackStateKey = 'warning') {
    const stateKey = normalizeStateKey(session?.stateKey || fallbackStateKey);
    const severity = trimText(session?.playbook?.severity).toLowerCase();
    const cls = trimText(session?.cls);

    if (stateKey === 'healthy' || stateKey === 'after_maintenance') return RISK_LEVELS.low;
    if (stateKey === 'service' || session?.workStatus === 'repair') return RISK_LEVELS.high;
    if (
      severity.includes('крит') ||
      ['tooth_miss', 'root_crack', 'combination'].includes(cls)
    ) return RISK_LEVELS.critical;
    if (
      severity.includes('высок') ||
      ['inner_race'].includes(cls)
    ) return RISK_LEVELS.high;
    if (stateKey === 'warning') return RISK_LEVELS.medium;
    return RISK_LEVELS.medium;
  }

  function clampNumber(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function getHealthTone(score) {
    if (score >= 86) return 'good';
    if (score >= 66) return 'info';
    if (score >= 46) return 'warning';
    return 'critical';
  }

  function scoreSessionHealth(session, fallbackStateKey = 'warning') {
    const stateKey = normalizeStateKey(session?.stateKey || fallbackStateKey);
    const cls = trimText(session?.cls || session?.predicted_class);
    const riskMeta = getRiskMeta(session, fallbackStateKey);
    let score = 100;

    score -= { low: 8, medium: 24, high: 42, critical: 62 }[riskMeta.key] || 20;
    score -= { healthy: 0, warning: 10, service: 18, after_maintenance: 4 }[stateKey] || 12;

    const classPenalty = {
      normal: 0,
      surface_wear: 10,
      ball_fault: 14,
      outer_race: 18,
      tooth_chip: 20,
      inner_race: 26,
      root_crack: 34,
      tooth_miss: 42,
      combination: 40,
    }[cls] || 16;
    score -= classPenalty;

    if (stateKey === 'healthy' && cls === 'normal') score += 8;
    if (stateKey === 'after_maintenance' && cls === 'normal') score += 12;
    if (session?.isBaseline) score += 10;
    if (session?.workStatus === 'repair') score -= 8;
    if (session?.workStatus === 'replaced') score += 6;

    const confidence = Number(session?.confidence || 0);
    score -= Math.max(0, confidence - 0.9) * 8;
    score += Math.max(0, 0.55 - confidence) * 10;
    return Math.round(clampNumber(score, 8, 99));
  }

  function buildHealthSeries(sessions, fallbackStateKey = 'warning') {
    if (!sessions.length) return [];
    return [...sessions]
      .reverse()
      .map((item) => ({
        id: item.id,
        score: scoreSessionHealth(item, fallbackStateKey),
        label: item.savedAt || item.createdAt || item.created_at || '',
        cls: item.cls,
        stateKey: normalizeStateKey(item.stateKey),
      }));
  }

  function getHealthTrendMeta(series) {
    if (!series.length) {
      return { label: 'Нет тренда', delta: 0, direction: 'stable', tone: 'info' };
    }
    const current = series[series.length - 1].score;
    const previous = series.length > 1 ? series[series.length - 2].score : current;
    const delta = current - previous;
    if (delta >= 6) return { label: 'Улучшение', delta, direction: 'up', tone: 'good' };
    if (delta <= -6) return { label: 'Деградация', delta, direction: 'down', tone: 'critical' };
    return { label: 'Стабильно', delta, direction: 'flat', tone: 'info' };
  }

  function buildHealthSparkline(series, stroke = '#6ee7f9', fill = 'rgba(110,231,249,0.12)') {
    if (!series.length) {
      return '<div class="fleet-sparkline-empty">Недостаточно данных</div>';
    }
    const width = 180;
    const height = 64;
    const points = series.map((item) => item.score);
    const min = Math.min(...points, 0);
    const max = Math.max(...points, 100);
    const spread = Math.max(1, max - min);
    const coords = points.map((score, index) => {
      const x = series.length === 1 ? width / 2 : (index / (series.length - 1)) * width;
      const y = height - ((score - min) / spread) * (height - 10) - 5;
      return [x, y];
    });
    const polyline = coords.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
    const area = [`0,${height}`, ...coords.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`), `${width},${height}`].join(' ');
    const last = coords[coords.length - 1];
    return `
      <svg class="fleet-sparkline" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" aria-hidden="true">
        <polyline class="fleet-sparkline-area" points="${area}" style="fill:${fill}"></polyline>
        <polyline class="fleet-sparkline-line" points="${polyline}" style="stroke:${stroke}"></polyline>
        <circle cx="${last[0].toFixed(1)}" cy="${last[1].toFixed(1)}" r="3.6" style="fill:${stroke}"></circle>
      </svg>
    `;
  }

  function getHealthLabel(score) {
    if (score >= 86) return 'Stable';
    if (score >= 66) return 'Controlled';
    if (score >= 46) return 'Needs attention';
    return 'Critical';
  }

  function formatSignedScore(value) {
    const rounded = Math.round(value || 0);
    return `${rounded > 0 ? '+' : ''}${rounded}`;
  }

  function getHealthPalette(tone) {
    const map = {
      good: { stroke: '#34d399', fill: 'rgba(52,211,153,0.14)' },
      info: { stroke: '#6ee7f9', fill: 'rgba(110,231,249,0.14)' },
      warning: { stroke: '#fbbf24', fill: 'rgba(251,191,36,0.14)' },
      critical: { stroke: '#f87171', fill: 'rgba(248,113,113,0.16)' },
    };
    return map[tone] || map.info;
  }

  function getLatestAssetSession(assetId) {
    return getAssetSessions(assetId)[0] || null;
  }

  function getAssetOverview(asset) {
    const sessions = getAssetSessions(asset.id);
    const measurements = getAssetMeasurements(asset.id);
    const latestMeasurement = measurements[0] || null;
    const latest = sessions[0] || null;
    const stateMeta = latest ? getSessionStateMeta(latest.stateKey) : getSessionStateMeta(asset.currentStatus);
    const workMeta = latest ? getWorkStatusMeta(latest.workStatus) : getWorkStatusMeta('observe');
    const riskMeta = getRiskMeta(latest, asset.currentStatus);
    const reportCount = sessions.filter((item) => getReportByInspection(item.id)).length;
    const baseline = getAssetBaselineSession(asset.id);
    const lastUpdated = latest?.savedAt || asset.updated_at || asset.updatedAt || asset.created_at || asset.createdAt || null;
    const healthSeries = sessions.length
      ? buildHealthSeries(sessions, asset.currentStatus)
      : [{ id: asset.id, score: scoreSessionHealth(null, asset.currentStatus), label: lastUpdated, cls: 'normal', stateKey: asset.currentStatus }];
    const healthScore = healthSeries[healthSeries.length - 1]?.score || scoreSessionHealth(null, asset.currentStatus);
    const healthTrend = getHealthTrendMeta(healthSeries);
    const healthTone = getHealthTone(healthScore);
    const stageTrail = [];
    [...sessions].reverse().forEach((item) => {
      const stage = normalizeStateKey(item.stateKey);
      if (!stageTrail.length || stageTrail[stageTrail.length - 1] !== stage) {
        stageTrail.push(stage);
      }
    });
    return {
      asset,
      sessions,
      measurements,
      latestMeasurement,
      latest,
      baseline,
      stateMeta,
      workMeta,
      riskMeta,
      reportCount,
      measurementCount: measurements.length,
      lastUpdated,
      healthScore,
      healthTone,
      healthSeries,
      healthTrend,
      stageTrail,
    };
  }

  function getFilteredAssetOverviews() {
    const query = trimText(assetSearchQuery).toLowerCase();
    return assetRegistry
      .map(getAssetOverview)
      .filter((overview) => {
        const matchesQuery = !query || overview.asset.name.toLowerCase().includes(query);
        const matchesStatus = assetStatusFilter === 'all' || normalizeStateKey(overview.latest?.stateKey || overview.asset.currentStatus) === assetStatusFilter;
        const matchesRisk = assetRiskFilter === 'all' || overview.riskMeta.key === assetRiskFilter;
        return matchesQuery && matchesStatus && matchesRisk;
      })
      .sort((a, b) => {
        if (assetSortMode === 'health_asc') {
          return a.healthScore - b.healthScore;
        }
        if (assetSortMode === 'health_desc') {
          return b.healthScore - a.healthScore;
        }
        if (assetSortMode === 'name') {
          return a.asset.name.localeCompare(b.asset.name, 'ru');
        }
        if (assetSortMode === 'recovery') {
          const recoveryScoreA = normalizeStateKey(a.latest?.stateKey || a.asset.currentStatus) === 'after_maintenance' ? -1 : 0;
          const recoveryScoreB = normalizeStateKey(b.latest?.stateKey || b.asset.currentStatus) === 'after_maintenance' ? -1 : 0;
          if (recoveryScoreA !== recoveryScoreB) return recoveryScoreA - recoveryScoreB;
        }
        const riskWeight = { critical: 4, high: 3, medium: 2, low: 1 };
        const riskA = riskWeight[a.riskMeta.key] || 0;
        const riskB = riskWeight[b.riskMeta.key] || 0;
        if (riskA !== riskB) return riskB - riskA;
        if (a.healthScore !== b.healthScore) return a.healthScore - b.healthScore;
        const timeA = a.lastUpdated ? new Date(a.lastUpdated).getTime() : 0;
        const timeB = b.lastUpdated ? new Date(b.lastUpdated).getTime() : 0;
        return timeB - timeA;
      });
  }

  function syncWorkStatusFromState(force = false) {
    const stateNode = el('sessionStateInput');
    const workNode = el('workStatusInput');
    if (!stateNode || !workNode) return;
    const stateKey = normalizeStateKey(stateNode.value);
    const currentWork = trimText(workNode.value);
    const nextWork = stateKey === 'service'
      ? 'repair'
      : stateKey === 'after_maintenance'
        ? 'replaced'
        : stateKey === 'warning'
          ? 'inspect'
          : 'observe';
    if (force || !currentWork || currentWork === 'observe' || currentWork === 'inspect' || currentWork === 'repair' || currentWork === 'replaced') {
      workNode.value = nextWork;
    }
  }

  function getCurrentAssetName() {
    return trimText(el('assetNameInput')?.value) || 'Не указан объект';
  }

  function getCurrentSessionState() {
    return normalizeStateKey(el('sessionStateInput')?.value);
  }

  function getCurrentWorkStatus() {
    const key = trimText(el('workStatusInput')?.value);
    return WORK_STATUSES[key] ? key : 'observe';
  }

  function getCurrentSessionNote() {
    return trimText(el('sessionNoteInput')?.value);
  }

  function getCurrentEngineerReason() {
    return trimText(el('engineerReasonInput')?.value);
  }

  function getCurrentActionTaken() {
    return trimText(el('actionTakenInput')?.value);
  }

  function getSaveActionLabel() {
    if (!apiReady) return 'API НЕДОСТУПЕН';
    return authState?.id ? 'СОХРАНИТЬ В ПРОФИЛЬ' : 'ВОЙТИ В ПРОФИЛЬ';
  }

  function buildCaptureSummaryMarkup() {
    if (!currentDiagnosis) {
      return 'Запустите анализ, затем сохраните текущий результат в журнал состояний.';
    }
    const stateMeta = getSessionStateMeta(getCurrentSessionState());
    const workMeta = getWorkStatusMeta(getCurrentWorkStatus());
    const confidence = ((currentDiagnosis.confidence || 0) * 100).toFixed(1);
    return `<div class="workspace-summary-label">ТЕКУЩИЙ СЕАНС</div>
      <div class="workspace-summary-value">
        ${escapeHtml(currentDiagnosis.input?.label || currentDiagnosis.sourceLabel || 'Сигнал')} ·
        <span style="color:${VM.COLORS[currentDiagnosis.cls] || '#fff'}">${escapeHtml(VM.RU[currentDiagnosis.cls] || currentDiagnosis.cls)}</span>
        · CONF ${confidence}%
      </div>
      <div style="margin-top:8px;font-size:12px;color:#96a4b7;line-height:1.7">
        Объект: <strong style="color:#fff">${escapeHtml(getCurrentAssetName())}</strong><br>
        Состояние записи: <strong style="color:#fff">${escapeHtml(stateMeta.label)}</strong><br>
        Статус работ: <strong style="color:#fff">${escapeHtml(workMeta.label)}</strong><br>
        ${getCurrentEngineerReason() ? `Почему: <strong style="color:#fff">${escapeHtml(getCurrentEngineerReason())}</strong><br>` : ''}
        ${getCurrentActionTaken() ? `Что сделано: <strong style="color:#fff">${escapeHtml(getCurrentActionTaken())}</strong><br>` : ''}
        ${escapeHtml(currentDiagnosis.playbook.priority)}
      </div>`;
  }

  function renderCaptureSummary() {
    const node = el('captureSummary');
    if (!node) return;
    node.innerHTML = buildCaptureSummaryMarkup();
    document.querySelectorAll('[data-save-session]').forEach((button) => {
      button.textContent = getSaveActionLabel();
    });
  }

  function updateHeaderProfile() {
    const chip = el('headerProfileChip');
    if (!chip) return;
    if (!apiReady) {
      chip.textContent = 'BACKEND OFFLINE';
      chip.classList.remove('profile-chip--active');
      return;
    }
    if (authState?.id) {
      chip.textContent = `${authState.name.toUpperCase()}${authState.role ? ' · ' + authState.role.toUpperCase() : ''}`;
      chip.classList.add('profile-chip--active');
    } else {
      chip.textContent = 'АККАУНТ · ГОСТЬ';
      chip.classList.remove('profile-chip--active');
    }
  }

  function renderAuthSummary() {
    const node = el('authSummary');
    if (!node) return;
    const importBtn = el('authImportBtn');
    const logoutBtn = el('authLogoutBtn');
    if (el('authNameInput')) el('authNameInput').value = authState?.name || '';
    if (el('authEmailInput')) el('authEmailInput').value = authState?.email || '';
    if (el('authPasswordInput')) el('authPasswordInput').value = '';
    if (logoutBtn) logoutBtn.style.display = authState?.id ? 'inline-flex' : 'none';
    if (importBtn) importBtn.style.display = authState?.id && hasLegacySessions() && !isLegacyImportDone() ? 'inline-flex' : 'none';

    if (!apiReady) {
      node.innerHTML = `<div class="workspace-summary-label">СЕРВЕРНЫЙ КОНТУР</div>
        <div class="workspace-summary-value">API недоступен</div>
        <div style="margin-top:8px;font-size:12px;color:#92a1b4;line-height:1.7">
          Запустите FastAPI backend, чтобы авторизация, история и отчёты сохранялись в базе данных, а не только в браузере.
        </div>`;
      return;
    }

    if (!authState?.id) {
      node.innerHTML = `<div class="workspace-summary-label">СЕРВЕРНЫЙ ДОСТУП</div>
        <div class="workspace-summary-value">Гостевой режим</div>
        <div style="margin-top:8px;font-size:12px;color:#92a1b4;line-height:1.7">
          Зарегистрируйтесь или войдите по email и паролю, чтобы сохранять сеансы в базе данных и вести историю по узлам.
        </div>
        ${hasLegacySessions() && !isLegacyImportDone() ? `
          <div style="margin-top:12px;font-size:12px;color:#c6d1de;line-height:1.7">
            Найден локальный журнал в браузере. После входа его можно перенести на сервер.
          </div>` : ''}
      `;
      return;
    }

    node.innerHTML = `<div class="workspace-summary-label">АКТИВНЫЙ ПРОФИЛЬ</div>
      <div class="workspace-summary-value">${escapeHtml(authState.name)}</div>
      <div style="margin-top:8px;font-size:12px;color:#92a1b4;line-height:1.7">
        ${escapeHtml(authState.email)}<br>
        ${escapeHtml(authState.role || 'Роль не указана')} · активная сессия до ${escapeHtml(formatStamp(authState.sessionExpiresAt))}
      </div>
      <div class="workspace-summary-grid">
        <div class="workspace-summary-card">
          <div class="workspace-summary-label">СОХРАНЕННЫХ СЕАНСОВ</div>
          <div class="workspace-summary-value">${sessionHistory.length}</div>
        </div>
        <div class="workspace-summary-card">
          <div class="workspace-summary-label">УЗЛОВ</div>
          <div class="workspace-summary-value">${dashboardSummary?.assets ?? new Set(sessionHistory.map(item => item.assetName)).size}</div>
        </div>
        <div class="workspace-summary-card">
          <div class="workspace-summary-label">ИЗМЕРЕНИЙ</div>
          <div class="workspace-summary-value">${dashboardSummary?.measurements ?? measurementRegistry.length}</div>
        </div>
      </div>
      ${hasLegacySessions() && !isLegacyImportDone() ? `
        <div style="margin-top:12px;font-size:12px;color:#c6d1de;line-height:1.7">
          В браузере найден локальный журнал. Нажмите «Импорт из браузера», чтобы перенести старые записи в серверную базу.
        </div>` : ''}
    `;
  }

  function renderHistoryStats() {
    const node = el('historyStats');
    if (!node) return;
    const uniqueAssets = new Set(sessionHistory.map(item => item.assetName).filter(Boolean)).size;
    const latest = sessionHistory[0]?.savedAt ? formatStamp(sessionHistory[0].savedAt) : '—';
    const assetCount = dashboardSummary?.assets ?? uniqueAssets ?? 0;
    node.innerHTML = `
      <span class="workspace-stat-pill">${sessionHistory.length} сеансов</span>
      <span class="workspace-stat-pill">${assetCount} узлов</span>
      <span class="workspace-stat-pill">${measurementRegistry.length} измерений</span>
      <span class="workspace-stat-pill">${reportRegistry.length} отчётов</span>
      <span class="workspace-stat-pill">Обновлено ${escapeHtml(latest)}</span>
    `;
  }

  function renderHistory() {
    const listNode = el('historyList');
    const emptyNode = el('historyEmpty');
    if (!listNode || !emptyNode) return;

    renderHistoryStats();
    if (!sessionHistory.length) {
      emptyNode.style.display = 'block';
      listNode.innerHTML = '';
      return;
    }

    emptyNode.style.display = 'none';
    listNode.innerHTML = sessionHistory.map((item) => {
      const stateMeta = getSessionStateMeta(item.stateKey);
      const workMeta = getWorkStatusMeta(item.workStatus);
      const clsColor = VM.COLORS[item.cls] || '#fff';
      const confidence = ((item.confidence || 0) * 100).toFixed(1);
      const linkedReport = reportRegistry.find((report) => report.inspectionId === item.id);
      return `<article class="history-item">
        <div class="history-item-header">
          <div>
            <div class="history-item-title">${escapeHtml(item.assetName || 'Не указан объект')}</div>
            <div class="history-item-meta">${escapeHtml(formatStamp(item.savedAt))} · ${escapeHtml(authState?.name || 'Аккаунт')} · ${escapeHtml(item.input?.label || item.input_label || 'Сеанс анализа')}</div>
          </div>
          <div class="history-badge-stack">
            <span class="health-badge health-badge--${stateMeta.tone}"><span class="dot"></span>${escapeHtml(stateMeta.label)}</span>
            <span class="health-badge health-badge--${workMeta.tone}"><span class="dot"></span>${escapeHtml(workMeta.label)}</span>
            ${item.isBaseline ? '<span class="health-badge health-badge--good"><span class="dot"></span>BASELINE</span>' : ''}
          </div>
        </div>
        <div class="history-item-grid">
          <div class="history-item-card">
            <div class="label">ДИАГНОЗ</div>
            <div style="color:${clsColor};font-size:15px;line-height:1.6">${escapeHtml(VM.RU[item.cls] || item.cls)}</div>
          </div>
          <div class="history-item-card">
            <div class="label">УВЕРЕННОСТЬ</div>
            <div style="color:#fff;font-size:15px;line-height:1.6">CONF ${confidence}%</div>
          </div>
          <div class="history-item-card">
            <div class="label">ПРИОРИТЕТ</div>
            <div style="color:#fff;font-size:15px;line-height:1.6">${escapeHtml(item.playbook?.priority || stateMeta.note)}</div>
          </div>
        </div>
        ${item.note ? `<div class="history-item-note">${escapeHtml(item.note)}</div>` : ''}
        ${(item.engineerReason || item.actionTaken) ? `
          <div class="history-item-note">
            ${item.engineerReason ? `<strong>Почему:</strong> ${escapeHtml(item.engineerReason)}<br>` : ''}
            ${item.actionTaken ? `<strong>Что сделано:</strong> ${escapeHtml(item.actionTaken)}` : ''}
          </div>` : ''}
        <div class="history-item-actions">
          <button class="history-btn" type="button" data-action="open" data-id="${escapeHtml(item.id)}">ОТКРЫТЬ</button>
          <button class="history-btn" type="button" data-action="reuse" data-id="${escapeHtml(item.id)}">ЗАПОЛНИТЬ ФОРМУ</button>
          <button class="history-btn" type="button" data-action="baseline" data-id="${escapeHtml(item.id)}">${item.isBaseline ? 'ЭТАЛОН ✓' : 'СДЕЛАТЬ BASELINE'}</button>
          <button class="history-btn" type="button" data-action="compare" data-id="${escapeHtml(item.id)}">СРАВНИТЬ</button>
          <button class="history-btn" type="button" data-action="report" data-id="${escapeHtml(item.id)}">${linkedReport ? 'ОТЧЁТ' : 'СОЗДАТЬ ОТЧЁТ'}</button>
          <button class="history-btn history-btn--danger" type="button" data-action="delete" data-id="${escapeHtml(item.id)}">УДАЛИТЬ</button>
        </div>
      </article>`;
    }).join('');
  }

  function renderAnalysisComparePanel() {
    const assetSelect = el('analysisCompareAssetSelect');
    const modeSelect = el('analysisCompareModeSelect');
    const referenceSelect = el('analysisCompareReferenceSelect');
    const targetSelect = el('analysisCompareTargetSelect');
    const summaryNode = el('analysisCompareSummary');
    const panel = el('analysisComparePanel');
    if (!assetSelect || !modeSelect || !referenceSelect || !targetSelect || !summaryNode || !panel) return;

    if (!assetRegistry.length || !sessionHistory.length) {
      panel.classList.add('is-empty');
      assetSelect.innerHTML = '<option value="">Нет узлов</option>';
      modeSelect.value = analysisCompareMode;
      referenceSelect.innerHTML = '<option value="">Нет сеансов</option>';
      targetSelect.innerHTML = '<option value="">Нет сеансов</option>';
      referenceSelect.disabled = true;
      targetSelect.disabled = true;
      summaryNode.innerHTML = '<div class="workspace-empty-block">Сохраните хотя бы один серверный сеанс, чтобы включить режим сравнения и сопоставлять эталонную, текущую и контрольную записи.</div>';
      return;
    }

    panel.classList.remove('is-empty');
    syncAnalysisCompareState();
    const context = getAnalysisCompareContext();
    const sessions = context.sessions;
    const currentSnapshot = getCurrentAnalysisSnapshot();
    const currentMatchesAsset = currentSnapshot && currentSnapshot.assetId === context.asset?.id;

    assetSelect.innerHTML = assetRegistry.map((asset) => `<option value="${escapeHtml(asset.id)}">${escapeHtml(asset.name)}</option>`).join('');
    if (analysisCompareAssetId) assetSelect.value = analysisCompareAssetId;
    modeSelect.value = analysisCompareMode;

    referenceSelect.disabled = !sessions.length;
    targetSelect.disabled = !sessions.length && !currentMatchesAsset;

    referenceSelect.innerHTML = sessions.length
      ? sessions.map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(buildSessionOptionLabel(item))}</option>`).join('')
      : '<option value="">Нет сеансов</option>';
    if (analysisCompareReferenceId) referenceSelect.value = analysisCompareReferenceId;

    const targetOptions = [];
    if (currentMatchesAsset) {
      targetOptions.push(`<option value="__current">Текущий анализ · ${escapeHtml(currentSnapshot.input?.label || 'Текущий сценарий')}</option>`);
    }
    targetOptions.push(...sessions.map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(buildSessionOptionLabel(item))}</option>`));
    targetSelect.innerHTML = targetOptions.join('') || '<option value="">Нет сеансов</option>';
    if (analysisCompareTargetId && [...targetSelect.options].some((option) => option.value === analysisCompareTargetId)) {
      targetSelect.value = analysisCompareTargetId;
    }

    const reference = context.reference;
    const target = context.target;
    if (!context.asset || !reference || !target) {
      summaryNode.innerHTML = `<div class="workspace-empty-block">${escapeHtml(context.modeMeta.note)} Выберите reference и target, чтобы построить инженерное сравнение.</div>`;
      return;
    }

    const referenceMetrics = signalMetrics(reference.signalData);
    const targetMetrics = signalMetrics(target.signalData);
    const rmsDeltaPct = referenceMetrics.rms ? ((targetMetrics.rms - referenceMetrics.rms) / referenceMetrics.rms) * 100 : null;
    const peakDeltaPct = referenceMetrics.peak ? ((targetMetrics.peak - referenceMetrics.peak) / referenceMetrics.peak) * 100 : null;
    const referenceClass = VM.RU[reference.cls] || reference.cls || '—';
    const targetClass = VM.RU[target.cls] || target.cls || '—';
    const stateTrail = `${getSessionStateMeta(reference.stateKey || 'healthy').label} → ${getSessionStateMeta(target.stateKey || 'warning').label}`;
    const note = target.actionTaken || target.engineerReason || target.note || reference.engineerReason || reference.note || context.modeMeta.note;

    summaryNode.innerHTML = `
      <div class="analysis-compare-header">
        <div>
          <div class="analysis-compare-kicker">${escapeHtml(context.modeMeta.label)}</div>
          <div class="analysis-compare-title">${escapeHtml(context.asset.name)} · ${escapeHtml(context.referenceLabel)} → ${escapeHtml(context.targetLabel)}</div>
        </div>
        <div class="history-badge-stack">
          <span class="health-badge health-badge--${getSessionStateMeta(reference.stateKey || 'healthy').tone}"><span class="dot"></span>${escapeHtml(getSessionStateMeta(reference.stateKey || 'healthy').label)}</span>
          <span class="health-badge health-badge--${getRiskMeta(target).tone}"><span class="dot"></span>${escapeHtml(getRiskMeta(target).label)}</span>
        </div>
      </div>
      <div class="analysis-compare-metrics">
        <div class="analysis-compare-metric">
          <span>Состояние</span>
          <strong>${escapeHtml(stateTrail)}</strong>
          <small>${escapeHtml(context.modeMeta.note)}</small>
        </div>
        <div class="analysis-compare-metric">
          <span>Диагноз</span>
          <strong>${escapeHtml(referenceClass)} → ${escapeHtml(targetClass)}</strong>
          <small>${((reference.confidence || 0) * 100).toFixed(1)}% → ${((target.confidence || 0) * 100).toFixed(1)}%</small>
        </div>
        <div class="analysis-compare-metric">
          <span>RMS</span>
          <strong>${referenceMetrics.rms.toFixed(3)} → ${targetMetrics.rms.toFixed(3)}</strong>
          <small>${escapeHtml(formatMetricDelta(rmsDeltaPct))}</small>
        </div>
        <div class="analysis-compare-metric">
          <span>Peak</span>
          <strong>${referenceMetrics.peak.toFixed(3)} → ${targetMetrics.peak.toFixed(3)}</strong>
          <small>${escapeHtml(formatMetricDelta(peakDeltaPct))}</small>
        </div>
      </div>
      <div class="analysis-compare-note">
        <strong>Инженерный вывод:</strong> ${escapeHtml(note)}
      </div>
    `;
  }

  function rerenderActiveDiagnosis() {
    if (!currentDiagnosis) return;
    const signal = Array.isArray(currentDiagnosis.signalData) && currentDiagnosis.signalData.length
      ? currentDiagnosis.signalData
      : Array.from(currentSignalData?.data || []);
    if (!signal.length) return;
    showDiagnosis(
      currentDiagnosis.cls,
      currentDiagnosis.probabilities || { [currentDiagnosis.cls]: currentDiagnosis.confidence || 1 },
      VM.COLORS[currentDiagnosis.cls],
      signal,
    );
  }

  function applyAnalysisCompareMode(nextMode, { force = true, openTarget = true } = {}) {
    analysisCompareMode = nextMode;
    syncAnalysisCompareState(force);
    renderAnalysisComparePanel();

    if (!openTarget) return;
    if (analysisCompareTargetId && analysisCompareTargetId !== '__current') {
      const activeSessionId = getActiveAnalysisSessionId();
      if (activeSessionId !== analysisCompareTargetId) {
        restoreSession(analysisCompareTargetId, 'open', { silent: true, skipScroll: true });
        return;
      }
    }
    rerenderActiveDiagnosis();
  }

  function renderWorkspace() {
    renderHistory();
    renderAnalysisComparePanel();
    renderMonitoringFeed();
    renderAssetFleet();
    renderAssetCard();
    renderAssetTrend();
    renderAssetWorkflow();
    renderAssetTimeline();
    renderComparePanel();
    renderReportPanel();
  }

  function getAssetById(assetId) {
    return assetRegistry.find((item) => item.id === assetId) || null;
  }

  function getMeasurementById(measurementId) {
    return measurementRegistry.find((item) => item.id === measurementId) || null;
  }

  function getAssetMeasurements(assetId) {
    return measurementRegistry.filter((item) => item.assetId === assetId);
  }

  function getAssetSessions(assetId) {
    return sessionHistory.filter((item) => item.assetId === assetId);
  }

  function getInspectionById(inspectionId) {
    return sessionHistory.find((item) => item.id === inspectionId) || null;
  }

  function getReportByInspection(inspectionId) {
    return reportRegistry.find((item) => item.inspectionId === inspectionId) || null;
  }

  function getAssetBaselineSession(assetId) {
    const sessions = getAssetSessions(assetId);
    return sessions.find((item) => item.isBaseline) || [...sessions].reverse().find((item) => item.stateKey === 'healthy') || null;
  }

  function getAssetByName(name) {
    const normalized = trimText(name).toLowerCase();
    return assetRegistry.find((item) => trimText(item.name).toLowerCase() === normalized) || null;
  }

  function signalMetrics(signal) {
    const data = Array.isArray(signal) ? signal : [];
    if (!data.length) return { rms: 0, peak: 0 };
    const sum = data.reduce((acc, value) => acc + value * value, 0);
    const peak = data.reduce((acc, value) => Math.max(acc, Math.abs(value)), 0);
    return { rms: Math.sqrt(sum / data.length), peak };
  }

  function buildSessionOptionLabel(item) {
    return `${item.isBaseline ? '[BASELINE] ' : ''}${formatStamp(item.savedAt)} · ${item.assetName} · ${VM.RU[item.cls] || item.cls}`;
  }

  function shouldAutoMarkBaseline() {
    if (!currentDiagnosis) return false;
    const stateKey = getCurrentSessionState();
    if (!['healthy', 'after_maintenance'].includes(stateKey)) return false;
    if (currentDiagnosis.cls !== 'normal') return false;
    const assetName = getCurrentAssetName();
    if (!assetName) return false;
    const asset = getAssetByName(assetName);
    return asset ? !getAssetBaselineSession(asset.id) : true;
  }

  function getSimulatorLaunchConfig(cls) {
    const mapping = {
      normal: { fault: 'normal', preset: 'healthy' },
      tooth_chip: { fault: 'chip' },
      tooth_miss: { fault: 'miss' },
      root_crack: { fault: 'crack' },
      surface_wear: { fault: 'wear' },
      ball_fault: { fault: 'ball', preset: 'bearing' },
      inner_race: { fault: 'inner', preset: 'bearing' },
      outer_race: { fault: 'outer', preset: 'bearing' },
      combination: { fault: 'chip', preset: 'multi' },
    };
    return mapping[cls] || { fault: 'normal', preset: 'healthy' };
  }

  function buildSimulatorLaunchUrl() {
    if (!currentDiagnosis) return 'simulator.html';
    const config = getSimulatorLaunchConfig(currentDiagnosis.cls);
    const params = new URLSearchParams();
    params.set('source', 'analysis');
    params.set('cls', currentDiagnosis.cls);
    params.set('fault', config.fault);
    if (config.preset) params.set('preset', config.preset);
    params.set('autofocus', '1');
    params.set('impact', '1');
    if (currentDiagnosis.confidence != null) params.set('confidence', String(Number(currentDiagnosis.confidence).toFixed(4)));
    if (currentInputContext?.label) params.set('label', currentInputContext.label);
    const assetName = getCurrentAssetName();
    if (assetName) params.set('asset', assetName);
    return `simulator.html?${params.toString()}`;
  }

  function openSimulatorFromAnalysis() {
    if (!currentDiagnosis) {
      toast('Нет диагноза', 'Сначала выполните анализ сигнала, затем откройте дефект в 3D.', 'warning');
      return;
    }
    window.open(buildSimulatorLaunchUrl(), '_blank', 'noopener,noreferrer');
  }

  function resolveAnalysisAsset() {
    const typedName = trimText(el('assetNameInput')?.value);
    if (typedName && typedName !== 'Не указан объект') {
      return getAssetByName(typedName) || getAssetById(selectedAssetId);
    }
    return getAssetById(selectedAssetId);
  }

  function getAnalysisBaselineSession() {
    const asset = resolveAnalysisAsset();
    return asset ? getAssetBaselineSession(asset.id) : null;
  }

  function getLatestDefectSession(assetId) {
    const sessions = getAssetSessions(assetId);
    return sessions.find((item) => item.cls !== 'normal' || !['healthy', 'after_maintenance'].includes(item.stateKey)) || sessions[0] || null;
  }

  function getMaintenanceComparisonPair(assetId) {
    const sessions = getAssetSessions(assetId);
    const target = sessions.find((item) => item.stateKey === 'after_maintenance');
    if (!target) return null;
    const index = sessions.findIndex((item) => item.id === target.id);
    const olderSessions = index >= 0 ? sessions.slice(index + 1) : [];
    const reference = olderSessions.find((item) => ['service', 'warning'].includes(item.stateKey)) || olderSessions[0] || null;
    return reference ? { reference, target } : null;
  }

  function getAnalysisCompareModeMeta(mode = analysisCompareMode) {
    const map = {
      baseline_current: {
        label: 'BASELINE VS CURRENT',
        referenceLabel: 'Baseline',
        targetLabel: 'Current',
        note: 'Сравнение живого анализа с эталонным healthy-сеансом этого объекта.',
      },
      baseline_saved: {
        label: 'BASELINE VS SAVED SESSION',
        referenceLabel: 'Baseline',
        targetLabel: 'Saved session',
        note: 'Сравнение эталона и сохранённого дефектного сеанса из серверной истории.',
      },
      before_after: {
        label: 'BEFORE VS AFTER MAINTENANCE',
        referenceLabel: 'Before',
        targetLabel: 'After',
        note: 'Сравнение объекта до ремонта и после завершения сервисного цикла.',
      },
    };
    return map[mode] || map.baseline_current;
  }

  function getActiveAnalysisSessionId() {
    return trimText(currentDiagnosis?.input?.sessionId || currentInputContext?.sessionId) || null;
  }

  function getCurrentAnalysisSnapshot() {
    if (!currentDiagnosis) return null;
    const asset = resolveAnalysisAsset() || getAssetById(analysisCompareAssetId) || null;
    return {
      id: '__current',
      assetId: asset?.id || null,
      assetName: asset?.name || getCurrentAssetName(),
      cls: currentDiagnosis.cls,
      confidence: currentDiagnosis.confidence,
      probabilities: { ...(currentDiagnosis.probabilities || {}) },
      input: {
        ...(currentDiagnosis.input || {}),
        label: currentDiagnosis.input?.label || currentDiagnosis.sourceLabel || 'Текущий анализ',
      },
      playbook: currentDiagnosis.playbook || {},
      signalData: compactSignal(currentDiagnosis.signalData || currentSignalData?.data || []),
      sampleRate: currentDiagnosis.sampleRate || currentSignalData?.sampleRate || VM.FS,
      stateKey: getCurrentSessionState(),
      workStatus: getCurrentWorkStatus(),
      note: getCurrentSessionNote(),
      engineerReason: getCurrentEngineerReason(),
      actionTaken: getCurrentActionTaken(),
      isBaseline: false,
      isCurrent: true,
    };
  }

  function getCompareSessionLabel(session, fallback) {
    if (!session) return fallback;
    if (session.isCurrent) return 'Current';
    if (session.isBaseline) return 'Baseline';
    const shortLabels = {
      healthy: 'Healthy',
      warning: 'Warning',
      service: 'Service',
      after_maintenance: 'After',
    };
    return shortLabels[session.stateKey] || getSessionStateMeta(session.stateKey).label;
  }

  function syncAnalysisCompareState(force = false) {
    const resolvedAsset = resolveAnalysisAsset() || getAssetById(analysisCompareAssetId) || getAssetById(selectedAssetId) || assetRegistry[0] || null;
    if (resolvedAsset && (force || !analysisCompareAssetId || !getAssetById(analysisCompareAssetId))) {
      analysisCompareAssetId = resolvedAsset.id;
    }
    if (!analysisCompareAssetId || !getAssetById(analysisCompareAssetId)) {
      analysisCompareAssetId = assetRegistry[0]?.id || null;
    }

    const assetId = analysisCompareAssetId;
    const sessions = assetId ? getAssetSessions(assetId) : [];
    const baseline = assetId ? getAssetBaselineSession(assetId) : null;
    const latestDefect = assetId ? getLatestDefectSession(assetId) : null;
    const maintenancePair = assetId ? getMaintenanceComparisonPair(assetId) : null;
    const currentSnapshot = getCurrentAnalysisSnapshot();
    const currentMatchesAsset = currentSnapshot && currentSnapshot.assetId === assetId;
    const lastSession = sessions[sessions.length - 1] || null;

    if (analysisCompareMode === 'before_after') {
      if (force || !analysisCompareReferenceId || !sessions.some((item) => item.id === analysisCompareReferenceId)) {
        analysisCompareReferenceId = maintenancePair?.reference?.id || baseline?.id || lastSession?.id || null;
      }
      if (
        force
        || (analysisCompareTargetId === '__current' && !currentMatchesAsset)
        || (analysisCompareTargetId !== '__current' && !sessions.some((item) => item.id === analysisCompareTargetId))
      ) {
        analysisCompareTargetId = maintenancePair?.target?.id || (currentMatchesAsset ? '__current' : latestDefect?.id || sessions[0]?.id || '__current');
      }
    } else if (analysisCompareMode === 'baseline_saved') {
      if (force || !analysisCompareReferenceId || !sessions.some((item) => item.id === analysisCompareReferenceId)) {
        analysisCompareReferenceId = baseline?.id || lastSession?.id || null;
      }
      if (force || !analysisCompareTargetId || analysisCompareTargetId === '__current' || !sessions.some((item) => item.id === analysisCompareTargetId)) {
        analysisCompareTargetId = latestDefect?.id || sessions[0]?.id || '__current';
      }
    } else {
      if (force || !analysisCompareReferenceId || !sessions.some((item) => item.id === analysisCompareReferenceId)) {
        analysisCompareReferenceId = baseline?.id || lastSession?.id || null;
      }
      if (
        force
        || (analysisCompareTargetId === '__current' && !currentMatchesAsset)
        || (analysisCompareTargetId !== '__current' && !sessions.some((item) => item.id === analysisCompareTargetId))
      ) {
        analysisCompareTargetId = currentMatchesAsset ? '__current' : latestDefect?.id || sessions[0]?.id || '__current';
      }
    }

    if (analysisCompareReferenceId && analysisCompareReferenceId === analysisCompareTargetId) {
      const alternative = sessions.find((item) => item.id !== analysisCompareReferenceId) || null;
      if (analysisCompareTargetId === '__current') {
        analysisCompareReferenceId = alternative?.id || analysisCompareReferenceId;
      } else {
        analysisCompareTargetId = alternative?.id || analysisCompareTargetId;
      }
    }
  }

  function getAnalysisCompareContext() {
    syncAnalysisCompareState();
    const asset = getAssetById(analysisCompareAssetId) || null;
    const sessions = asset ? getAssetSessions(asset.id) : [];
    const modeMeta = getAnalysisCompareModeMeta();
    const reference = getInspectionById(analysisCompareReferenceId) || null;
    const target = analysisCompareTargetId === '__current'
      ? getCurrentAnalysisSnapshot()
      : getInspectionById(analysisCompareTargetId) || null;
    return {
      asset,
      sessions,
      modeMeta,
      reference,
      target,
      referenceLabel: getCompareSessionLabel(reference, modeMeta.referenceLabel),
      targetLabel: getCompareSessionLabel(target, modeMeta.targetLabel),
    };
  }

  function formatEngineeringFreq(freq) {
    return `${freq >= 100 ? freq.toFixed(0) : freq.toFixed(1)} Hz`;
  }

  function getCharacteristicMarkers(cls) {
    const fRot = Number(meta?.config?.f_rot || VM.F_ROT || 20);
    const gmf = Number(meta?.config?.gmf || VM.GMF || 400);
    const bsf = Number(meta?.config?.bsf || (fRot * 2.1));
    const bpfo = Number(meta?.config?.bpfo || (fRot * 3.5));
    const bpfi = Number(meta?.config?.bpfi || (fRot * 5.2));
    const markerSets = {
      normal: [
        { label: 'f_rot', freq: fRot, color: '#8ea0b5' },
        { label: 'GMF', freq: gmf, color: '#fb923c' },
        { label: '2×GMF', freq: gmf * 2, color: '#fbbf24' },
      ],
      tooth_chip: [
        { label: 'GMF-f_rot', freq: gmf - fRot, color: '#fb923c' },
        { label: 'GMF', freq: gmf, color: '#fb923c' },
        { label: 'GMF+f_rot', freq: gmf + fRot, color: '#fbbf24' },
      ],
      tooth_miss: [
        { label: 'GMF', freq: gmf, color: '#f87171' },
        { label: 'GMF+f_rot', freq: gmf + fRot, color: '#fb923c' },
        { label: '2×GMF', freq: gmf * 2, color: '#fbbf24' },
      ],
      root_crack: [
        { label: 'f_rot', freq: fRot, color: '#a78bfa' },
        { label: 'GMF-f_rot', freq: gmf - fRot, color: '#c084fc' },
        { label: 'GMF+f_rot', freq: gmf + fRot, color: '#c084fc' },
      ],
      surface_wear: [
        { label: 'GMF/2', freq: gmf / 2, color: '#fbbf24' },
        { label: 'GMF', freq: gmf, color: '#fb923c' },
        { label: 'HF band', freq: Math.min(gmf * 2, 1600), color: '#fde68a' },
      ],
      ball_fault: [
        { label: 'BSF', freq: bsf, color: '#34d399' },
        { label: '2×BSF', freq: bsf * 2, color: '#86efac' },
        { label: 'f_rot', freq: fRot, color: '#8ea0b5' },
      ],
      inner_race: [
        { label: 'BPFI', freq: bpfi, color: '#38bdf8' },
        { label: '2×BPFI', freq: bpfi * 2, color: '#7dd3fc' },
        { label: 'f_rot', freq: fRot, color: '#8ea0b5' },
      ],
      outer_race: [
        { label: 'BPFO', freq: bpfo, color: '#f472b6' },
        { label: '2×BPFO', freq: bpfo * 2, color: '#f9a8d4' },
        { label: 'f_rot', freq: fRot, color: '#8ea0b5' },
      ],
      combination: [
        { label: 'GMF', freq: gmf, color: '#fb923c' },
        { label: 'BPFI', freq: bpfi, color: '#38bdf8' },
        { label: 'BPFO', freq: bpfo, color: '#f472b6' },
        { label: 'BSF', freq: bsf, color: '#34d399' },
      ],
    };
    return (markerSets[cls] || markerSets.normal)
      .filter((marker) => Number.isFinite(marker.freq) && marker.freq > 0)
      .sort((a, b) => a.freq - b.freq);
  }

  function formatMetricDelta(value) {
    if (value == null || !Number.isFinite(value)) return 'n/a';
    return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;
  }

  function getEngineeringInterpretation(cls, assessment) {
    const hintMap = {
      normal: {
        title: 'Сигнал близок к эталону',
        note: 'Для нормального кейса важно, чтобы рабочие гармоники оставались стабильными, а вокруг GMF не появлялись выраженные боковые полосы и ударные события.',
      },
      tooth_chip: {
        title: 'Локальный gear fault',
        note: 'Ищем боковые полосы вокруг GMF и одиночные ударные события на частоте вращения. Именно они отличают ранний скол от нормального зацепления.',
      },
      tooth_miss: {
        title: 'Критическое разрушение зацепления',
        note: 'Ключевой признак — резкое усиление импульсов и распад чистой GMF-структуры. Такой кейс удобно показывать как контраст к healthy baseline.',
      },
      root_crack: {
        title: 'Модуляция на частоте вращения',
        note: 'Для трещины корня важны боковые полосы GMF ± f_rot и неустойчивость амплитуды. Это один из лучших кейсов для объяснения причинно-следственной связи.',
      },
      surface_wear: {
        title: 'Рост широкополосной энергии',
        note: 'При износе поверхность даёт не одиночный удар, а общий подъём шумового пола и усиление высокочастотной составляющей.',
      },
      ball_fault: {
        title: 'Bearing pattern в зоне BSF',
        note: 'Нужно смотреть не на GMF, а на BSF и его гармоники. Это помогает жюри сразу увидеть разницу между gear и bearing сценарием.',
      },
      inner_race: {
        title: 'Bearing pattern в зоне BPFI',
        note: 'Для внутренней обоймы ключевые признаки концентрируются возле BPFI. Сравнение с baseline полезно, потому что рост этой зоны видно очень наглядно.',
      },
      outer_race: {
        title: 'Bearing pattern в зоне BPFO',
        note: 'Наружная обойма чаще даёт устойчивый повторяющийся рисунок около BPFO. Это хороший кейс для объяснения локализации дефекта по спектру.',
      },
      combination: {
        title: 'Смешанный спектральный сценарий',
        note: 'Комбинированный случай показывает, что модель различает не один признак, а суперпозицию нескольких механизмов деградации сразу.',
      },
    };
    const base = hintMap[cls] || hintMap.normal;
    const deltaContext = assessment.baseline
      ? `От reference-сеанса: RMS ${formatMetricDelta(assessment.rmsDeltaPct)}, Peak ${formatMetricDelta(assessment.peakDeltaPct)}.`
      : 'Reference-сеанс ещё не назначен, поэтому сравнение пока идёт только по текущему паттерну.';
    return {
      title: base.title,
      note: `${base.note} ${deltaContext}`,
    };
  }

  function buildEngineeringAssessment(signal, cls) {
    const currentSignal = Array.from(signal || []);
    const currentMetrics = signalMetrics(currentSignal);
    const markers = getCharacteristicMarkers(cls);
    const compareContext = getAnalysisCompareContext();
    const asset = compareContext.asset || resolveAnalysisAsset();
    const referenceSession = compareContext.reference || getAnalysisBaselineSession();
    const referenceMetrics = referenceSession?.signalData?.length ? signalMetrics(referenceSession.signalData) : null;
    const rmsDeltaPct = referenceMetrics?.rms ? ((currentMetrics.rms - referenceMetrics.rms) / referenceMetrics.rms) * 100 : null;
    const peakDeltaPct = referenceMetrics?.peak ? ((currentMetrics.peak - referenceMetrics.peak) / referenceMetrics.peak) * 100 : null;
    const interpretation = getEngineeringInterpretation(cls, {
      baseline: referenceSession,
      currentMetrics,
      baselineMetrics: referenceMetrics,
      rmsDeltaPct,
      peakDeltaPct,
    });
    const currentTarget = {
      id: '__current',
      isCurrent: true,
      cls,
      signalData: currentSignal,
      sampleRate: currentSignalData?.sampleRate || VM.FS,
      stateKey: getCurrentSessionState(),
      input: {
        label: currentInputContext?.label || 'Текущий анализ',
      },
    };
    const targetSession = analysisCompareTargetId === '__current' ? currentTarget : (compareContext.target || currentTarget);
    return {
      asset,
      referenceSession,
      targetSession,
      markers,
      currentMetrics,
      baselineMetrics: referenceMetrics,
      rmsDeltaPct,
      peakDeltaPct,
      interpretation,
      markerSummary: markers.map((marker) => `${marker.label} ${formatEngineeringFreq(marker.freq)}`).join(' · '),
      compareMode: compareContext.modeMeta.label,
      compareNote: compareContext.modeMeta.note,
      referenceLabel: compareContext.referenceLabel,
      targetLabel: analysisCompareTargetId === '__current' ? compareContext.modeMeta.targetLabel : compareContext.targetLabel,
    };
  }

  function buildEngineeringEvidenceMarkup(assessment) {
    const reference = assessment.referenceSession;
    const baselineCopy = reference
      ? `
        <div class="diag-evidence-card">
          <div class="diag-evidence-label">${escapeHtml(assessment.compareMode)}</div>
          <div class="diag-evidence-value">${escapeHtml(assessment.referenceLabel)} → ${escapeHtml(assessment.targetLabel)}</div>
          <div class="diag-evidence-note">
            ${escapeHtml(reference.assetName || assessment.asset?.name || 'Объект')} · ${escapeHtml(reference.input?.label || reference.title || 'Reference session')}<br>
            RMS ${assessment.baselineMetrics?.rms?.toFixed(3) || '0.000'} → ${assessment.currentMetrics.rms.toFixed(3)}
            · Peak ${assessment.baselineMetrics?.peak?.toFixed(3) || '0.000'} → ${assessment.currentMetrics.peak.toFixed(3)}
          </div>
          <div class="diag-delta-row">
            <span class="diag-delta-chip ${assessment.rmsDeltaPct != null && assessment.rmsDeltaPct > 0 ? 'diag-delta-chip--up' : 'diag-delta-chip--down'}">ΔRMS ${escapeHtml(formatMetricDelta(assessment.rmsDeltaPct))}</span>
            <span class="diag-delta-chip ${assessment.peakDeltaPct != null && assessment.peakDeltaPct > 0 ? 'diag-delta-chip--up' : 'diag-delta-chip--down'}">ΔPeak ${escapeHtml(formatMetricDelta(assessment.peakDeltaPct))}</span>
          </div>
        </div>`
      : `
        <div class="diag-evidence-card">
          <div class="diag-evidence-label">${escapeHtml(assessment.compareMode)}</div>
          <div class="diag-evidence-value">Reference-сеанс пока не назначен</div>
          <div class="diag-evidence-note">${escapeHtml(assessment.compareNote)} Назначьте baseline или откройте сохранённый сеанс объекта, чтобы получить управляемое сравнение прямо на этой странице.</div>
          <div class="diag-delta-row">
            <span class="diag-delta-chip">Текущий RMS ${assessment.currentMetrics.rms.toFixed(3)}</span>
            <span class="diag-delta-chip">Peak ${assessment.currentMetrics.peak.toFixed(3)}</span>
          </div>
        </div>`;
    return `
      <div class="diag-evidence">
        ${baselineCopy}
        <div class="diag-evidence-card">
          <div class="diag-evidence-label">ХАРАКТЕРНЫЕ ЧАСТОТЫ</div>
          <div class="diag-marker-row">
            ${assessment.markers.map((marker) => `<span class="diag-marker-pill" style="border-color:${marker.color || '#fbbf24'}55;background:${marker.color || '#fbbf24'}14">${escapeHtml(marker.label)} · ${escapeHtml(formatEngineeringFreq(marker.freq))}</span>`).join('')}
          </div>
          <div class="diag-evidence-note">${escapeHtml(assessment.markerSummary)}</div>
        </div>
        <div class="diag-evidence-card">
          <div class="diag-evidence-label">ЧТО ВАЖНО НА ГРАФИКЕ</div>
          <div class="diag-evidence-value">${escapeHtml(assessment.interpretation.title)}</div>
          <div class="diag-evidence-note">${escapeHtml(assessment.interpretation.note)}</div>
        </div>
      </div>
    `;
  }

  function renderEngineeringVisuals(signal, cls, color, assessment) {
    if (!signal || !signal.length) return;
    const sampleRate = currentSignalData?.sampleRate || VM.FS;
    const baseline = assessment.referenceSession;
    const baselineSignal = baseline?.signalData?.length ? Float64Array.from(baseline.signalData) : null;
    const { freqs, spectrum } = FFT.computeSpectrum(signal, sampleRate);

    if (currentStop) {
      currentStop();
      currentStop = null;
    }

    if (baselineSignal) {
      Viz.drawSignalComparison('sigCanvas', baselineSignal, signal, {
        baselineColor: '#94a3b8',
        currentColor: color,
        baselineLabel: assessment.referenceLabel,
        currentLabel: assessment.targetLabel,
      });
      const baselineSpectrum = FFT.computeSpectrum(baselineSignal, baseline.sampleRate || sampleRate);
      Viz.drawSpectrumComparison('specCanvas', freqs, spectrum, baselineSpectrum.spectrum, {
        currentColor: color,
        baselineColor: '#94a3b8',
        markers: assessment.markers,
        maxFreq: 2000,
        baselineLabel: assessment.referenceLabel,
        currentLabel: assessment.targetLabel,
      });
    } else {
      currentStop = Viz.drawSignal('sigCanvas', signal, color, false);
      Viz.drawSpectrumComparison('specCanvas', freqs, spectrum, null, {
        currentColor: color,
        markers: assessment.markers,
        maxFreq: 2000,
      });
    }

    Viz.addCrosshair(el('sigCanvas'), { type: 'signal', data: signal, sampleRate, color });
    Viz.addCrosshair(el('specCanvas'), { type: 'spectrum', data: spectrum, freqs, color });

    const sigBaseText = el('sigDesc')?.dataset.baseText || '';
    const specBaseText = el('specDesc')?.dataset.baseText || '';
    if (el('sigDesc')) {
      el('sigDesc').textContent = [
        sigBaseText,
        baseline
          ? `Overlay: серый контур — ${assessment.referenceLabel.toLowerCase()} ${baseline.input?.label || baseline.title || 'reference session'}, цветной — ${assessment.targetLabel.toLowerCase()}.`
          : 'Reference-сеанс не назначен: сохраните healthy-сеанс или откройте историю объекта, чтобы включить compare mode.',
      ].filter(Boolean).join(' ');
    }
    if (el('specDesc')) {
      el('specDesc').textContent = [
        specBaseText,
        `Инженерные маркеры: ${assessment.markerSummary}.`,
      ].filter(Boolean).join(' ');
    }
  }

  function syncWorkspaceSelection(preferredAssetId = null, preferredInspectionId = null) {
    const availableAssetIds = new Set(sessionHistory.map((item) => item.assetId).filter(Boolean));
    if (preferredAssetId && availableAssetIds.has(preferredAssetId)) {
      selectedAssetId = preferredAssetId;
    }
    if (!selectedAssetId || !availableAssetIds.has(selectedAssetId)) {
      selectedAssetId = sessionHistory[0]?.assetId || assetRegistry[0]?.id || null;
    }

    const assetSessions = getAssetSessions(selectedAssetId);
    if (!assetSessions.length) {
      compareBaselineId = null;
      compareTargetId = null;
      selectedReportInspectionId = null;
      return;
    }

    if (preferredInspectionId && assetSessions.some((item) => item.id === preferredInspectionId)) {
      compareTargetId = preferredInspectionId;
      selectedReportInspectionId = preferredInspectionId;
    }

    if (!compareTargetId || !assetSessions.some((item) => item.id === compareTargetId)) {
      compareTargetId = assetSessions[0].id;
    }

    const baselineSession = getAssetBaselineSession(selectedAssetId);
    if (!compareBaselineId || !assetSessions.some((item) => item.id === compareBaselineId)) {
      compareBaselineId = baselineSession?.id || assetSessions[assetSessions.length - 1].id;
    }
    if (compareBaselineId === compareTargetId && assetSessions.length > 1) {
      compareBaselineId = assetSessions[assetSessions.length - 1].id;
    }

    if (!selectedReportInspectionId || !assetSessions.some((item) => item.id === selectedReportInspectionId)) {
      selectedReportInspectionId = compareTargetId;
    }
    if (!analysisCompareAssetId || !getAssetById(analysisCompareAssetId)) {
      analysisCompareAssetId = selectedAssetId;
    }
  }

  function renderAssetFleet() {
    const statsNode = el('assetFleetStats');
    const listNode = el('assetFleetList');
    const emptyNode = el('assetFleetEmpty');
    if (!statsNode || !listNode || !emptyNode) return;
    if (el('assetSearchInput')) el('assetSearchInput').value = assetSearchQuery;
    if (el('assetStatusFilter')) el('assetStatusFilter').value = assetStatusFilter;
    if (el('assetRiskFilter')) el('assetRiskFilter').value = assetRiskFilter;
    if (el('assetSortSelect')) el('assetSortSelect').value = assetSortMode;

    const allOverviews = assetRegistry.map(getAssetOverview);
    const filtered = getFilteredAssetOverviews();
    const total = assetRegistry.length;
    const warningCount = allOverviews.filter((item) => item.stateMeta.label === SESSION_STATES.warning.label).length;
    const highRiskCount = allOverviews.filter((item) => ['high', 'critical'].includes(item.riskMeta.key)).length;
    const avgHealth = allOverviews.length ? Math.round(allOverviews.reduce((acc, item) => acc + item.healthScore, 0) / allOverviews.length) : 0;
    const recoveringCount = allOverviews.filter((item) => normalizeStateKey(item.latest?.stateKey || item.asset.currentStatus) === 'after_maintenance').length;
    const topPriority = [...allOverviews].sort((a, b) => {
      const riskWeight = { critical: 4, high: 3, medium: 2, low: 1 };
      const diff = (riskWeight[b.riskMeta.key] || 0) - (riskWeight[a.riskMeta.key] || 0);
      if (diff) return diff;
      return a.healthScore - b.healthScore;
    })[0] || null;
    const latestUpdate = filtered[0]?.lastUpdated || sessionHistory[0]?.savedAt || '—';
    if (filtered.length && !filtered.some((item) => item.asset.id === selectedAssetId)) {
      selectedAssetId = filtered[0].asset.id;
      syncWorkspaceSelection(selectedAssetId);
    }

    statsNode.innerHTML = `
      <div class="workspace-summary-label">ПАРК ОБЪЕКТОВ</div>
      <div class="workspace-summary-grid">
        <div class="workspace-summary-card">
          <div class="workspace-summary-label">ОБЪЕКТОВ</div>
          <div class="workspace-summary-value">${total}</div>
        </div>
        <div class="workspace-summary-card">
          <div class="workspace-summary-label">СРЕДНИЙ HEALTH</div>
          <div class="workspace-summary-value">${avgHealth}/100</div>
        </div>
        <div class="workspace-summary-card">
          <div class="workspace-summary-label">HIGH / CRITICAL</div>
          <div class="workspace-summary-value">${highRiskCount}</div>
        </div>
        <div class="workspace-summary-card">
          <div class="workspace-summary-label">RECOVERING</div>
          <div class="workspace-summary-value">${recoveringCount}</div>
        </div>
      </div>
      <div class="fleet-hero-note">
        <strong>Приоритетный объект:</strong>
        ${topPriority ? `${escapeHtml(topPriority.asset.name)} · ${topPriority.healthScore}/100 · ${escapeHtml(topPriority.riskMeta.label)}` : 'ещё не определён'}
        <br>
        <span>Warning-объектов: ${warningCount} · последнее обновление ${escapeHtml(formatStamp(latestUpdate))}</span>
      </div>
    `;

    if (!filtered.length) {
      emptyNode.style.display = 'block';
      emptyNode.textContent = total
        ? 'По текущим фильтрам объекты не найдены. Измените статус, риск или строку поиска.'
        : 'Список объектов появится после сохранения хотя бы одного серверного сеанса.';
      listNode.innerHTML = '';
      return;
    }

    emptyNode.style.display = 'none';
    listNode.innerHTML = filtered.map((overview) => {
      const latest = overview.latest;
      const latestDiagnosis = latest ? (VM.RU[latest.cls] || latest.cls) : 'Нет инспекций';
      const lastComment = latest?.actionTaken || latest?.engineerReason || latest?.note || overview.riskMeta.note;
      const palette = getHealthPalette(overview.healthTone);
      return `<article class="asset-fleet-card ${overview.asset.id === selectedAssetId ? 'is-active' : ''}" data-asset-card="${escapeHtml(overview.asset.id)}">
        <div class="asset-fleet-card-top">
          <div>
            <div class="asset-fleet-title">${escapeHtml(overview.asset.name)}</div>
            <div class="asset-fleet-meta">${escapeHtml(overview.asset.location || 'Локация не указана')} · ${escapeHtml(formatStamp(overview.lastUpdated))}</div>
          </div>
          <div class="history-badge-stack">
            <span class="health-badge health-badge--${overview.stateMeta.tone}"><span class="dot"></span>${escapeHtml(overview.stateMeta.label)}</span>
            <span class="health-badge health-badge--${overview.riskMeta.tone}"><span class="dot"></span>${escapeHtml(overview.riskMeta.label)}</span>
          </div>
        </div>
        <div class="asset-fleet-badges">
          <span class="health-badge health-badge--${overview.workMeta.tone}"><span class="dot"></span>${escapeHtml(overview.workMeta.label)}</span>
          <span class="health-badge"><span class="dot"></span>${escapeHtml(overview.asset.asset_type || 'gearbox')}</span>
          <span class="health-badge health-badge--${overview.healthTone}"><span class="dot"></span>${escapeHtml(getHealthLabel(overview.healthScore))}</span>
        </div>
        <div class="asset-health-row">
          <div class="asset-health-score asset-health-score--${overview.healthTone}">
            <span>Health score</span>
            <strong>${overview.healthScore}/100</strong>
            <small>${escapeHtml(overview.healthTrend.label)} · ${escapeHtml(formatSignedScore(overview.healthTrend.delta))}</small>
          </div>
          <div class="asset-health-sparkline">
            ${buildHealthSparkline(overview.healthSeries, palette.stroke, palette.fill)}
          </div>
        </div>
        <div class="asset-fleet-grid">
          <div class="asset-fleet-metric">
            <span>Последний диагноз</span>
            <strong>${escapeHtml(latestDiagnosis)}</strong>
          </div>
          <div class="asset-fleet-metric">
            <span>Инспекций</span>
            <strong>${overview.sessions.length}</strong>
          </div>
          <div class="asset-fleet-metric">
            <span>Измерений</span>
            <strong>${overview.measurementCount}</strong>
          </div>
          <div class="asset-fleet-metric">
            <span>Переход</span>
            <strong>${escapeHtml(overview.stageTrail.map((stage) => getSessionStateMeta(stage).label).join(' → ') || overview.stateMeta.label)}</strong>
          </div>
        </div>
        <div class="asset-fleet-note">${escapeHtml(lastComment)}</div>
      </article>`;
    }).join('');
  }

  function renderAssetCard() {
    const select = el('assetFocusSelect');
    const node = el('assetCardSummary');
    if (!select || !node) return;

    select.innerHTML = assetRegistry.length
      ? assetRegistry.map((asset) => `<option value="${escapeHtml(asset.id)}">${escapeHtml(asset.name)}</option>`).join('')
      : '<option value="">Нет объектов</option>';
    if (selectedAssetId) select.value = selectedAssetId;

    const asset = getAssetById(selectedAssetId);
    const overview = asset ? getAssetOverview(asset) : null;
    const latest = overview?.latest;
    const baseline = asset ? getAssetBaselineSession(asset.id) : null;
    if (!asset || !overview) {
      node.innerHTML = '<div class="workspace-empty-block">Выберите объект из списка слева или сохраните хотя бы один сеанс, чтобы появилась детальная карточка.</div>';
      return;
    }

    node.innerHTML = `
      <div class="workspace-insight-grid workspace-insight-grid--asset">
        <div class="workspace-insight-metric">
          <span>Текущее состояние</span>
          <strong>${escapeHtml(overview.stateMeta.label)}</strong>
          <small>${escapeHtml(overview.stateMeta.note)}</small>
        </div>
        <div class="workspace-insight-metric">
          <span>Health score</span>
          <strong>${overview.healthScore}/100 · ${escapeHtml(getHealthLabel(overview.healthScore))}</strong>
          <small>${escapeHtml(overview.healthTrend.label)} · ${escapeHtml(formatSignedScore(overview.healthTrend.delta))} от предыдущего сеанса</small>
        </div>
        <div class="workspace-insight-metric">
          <span>Последний диагноз</span>
          <strong>${latest ? escapeHtml(VM.RU[latest.cls] || latest.cls) : 'Пока нет inspection'}</strong>
          <small>${latest ? `CONF ${((latest.confidence || 0) * 100).toFixed(1)}%` : 'Есть raw-измерения, но диагностика ещё не сохранена в историю.'}</small>
        </div>
        <div class="workspace-insight-metric">
          <span>Статус работ / риск</span>
          <strong>${escapeHtml(overview.workMeta.label)} · ${escapeHtml(overview.riskMeta.label)}</strong>
          <small>${escapeHtml(overview.riskMeta.note)}</small>
        </div>
        <div class="workspace-insight-metric">
          <span>История</span>
          <strong>${overview.sessions.length} инспекций</strong>
          <small>${overview.measurementCount} измерений · ${overview.reportCount} отчётов · ${escapeHtml(formatStamp(overview.lastUpdated))}</small>
        </div>
        <div class="workspace-insight-metric">
          <span>Baseline</span>
          <strong>${baseline ? escapeHtml(VM.RU[baseline.cls] || baseline.cls) : 'Не назначен'}</strong>
          <small>${baseline ? escapeHtml(formatStamp(baseline.savedAt)) : 'Назначьте эталонный сеанс для сравнений и отчётов.'}</small>
        </div>
      </div>
      <div class="workspace-insight-copy">
        <strong>${escapeHtml(asset.name)}</strong>${asset.location ? ` · ${escapeHtml(asset.location)}` : ''}<br>
        ${asset.description ? escapeHtml(asset.description) : 'Карточка агрегирует текущий статус, последний диагноз и инженерный контекст по узлу.'}
      </div>
      ${(latest?.engineerReason || latest?.actionTaken) ? `
        <div class="workspace-insight-note">
          ${latest?.engineerReason ? `<div><strong>Почему принято решение:</strong> ${escapeHtml(latest.engineerReason)}</div>` : ''}
          ${latest?.actionTaken ? `<div><strong>Что сделано дальше:</strong> ${escapeHtml(latest.actionTaken)}</div>` : ''}
        </div>` : ''}
    `;
  }

  function renderAssetTrend() {
    const node = el('assetTrendSummary');
    if (!node) return;
    const asset = getAssetById(selectedAssetId);
    const overview = asset ? getAssetOverview(asset) : null;
    if (!asset || !overview) {
      node.innerHTML = '<div class="workspace-empty-block">Выберите объект с историей, чтобы увидеть health trend и изменение состояния по последним инспекциям.</div>';
      return;
    }

    const palette = getHealthPalette(overview.healthTone);
    const recentSeries = overview.healthSeries.slice(-6);
    const best = Math.max(...recentSeries.map((item) => item.score));
    const worst = Math.min(...recentSeries.map((item) => item.score));
    node.innerHTML = `
      <div class="asset-trend-hero">
        <div class="asset-trend-score asset-trend-score--${overview.healthTone}">
          <span>Current health</span>
          <strong>${overview.healthScore}</strong>
          <small>${escapeHtml(getHealthLabel(overview.healthScore))}</small>
        </div>
        <div class="asset-trend-copy">
          <div class="asset-trend-kicker">TREND</div>
          <div class="asset-trend-title">${escapeHtml(overview.healthTrend.label)} · ${escapeHtml(formatSignedScore(overview.healthTrend.delta))} относительно предыдущей инспекции</div>
          <div class="asset-trend-note">Лучшая точка: ${best}/100 · минимальное значение: ${worst}/100 · последние ${recentSeries.length} сеансов объекта.</div>
        </div>
      </div>
      <div class="asset-trend-chart">
        ${buildHealthSparkline(recentSeries, palette.stroke, palette.fill)}
      </div>
      <div class="asset-trend-grid">
        ${recentSeries.map((item, index) => `<div class="asset-trend-point">
          <span>#${index + 1}</span>
          <strong>${item.score}</strong>
          <small>${escapeHtml(getSessionStateMeta(item.stateKey).label)}</small>
        </div>`).join('')}
      </div>
    `;
  }

  function renderAssetTimeline() {
    const node = el('assetTimeline');
    if (!node) return;
    const sessions = getAssetSessions(selectedAssetId);
    if (!sessions.length) {
      node.innerHTML = '<div class="workspace-empty-block">Таймлайн состояния появится после сохранения последовательности сеансов по одному объекту.</div>';
      return;
    }
    const stageOrder = ['healthy', 'warning', 'service', 'after_maintenance'];
    const ascending = [...sessions].reverse();
    const latestStage = sessions[0].stateKey;
    const journey = [];
    ascending.forEach((item) => {
      const stage = normalizeStateKey(item.stateKey);
      if (!journey.length || journey[journey.length - 1] !== stage) journey.push(stage);
    });
    const events = ascending.map((item, index) => `
      <div class="timeline-event ${index === ascending.length - 1 ? 'timeline-event--current' : ''}">
        <div class="timeline-event-date">${escapeHtml(formatStamp(item.savedAt))}</div>
        <div class="timeline-event-body">
          <strong>${escapeHtml(getSessionStateMeta(item.stateKey).label)}</strong>
          <span>${escapeHtml(VM.RU[item.cls] || item.cls)} · ${escapeHtml(getWorkStatusMeta(item.workStatus).label)}</span>
          <div class="timeline-event-badges">
            <span class="health-badge health-badge--${getSessionStateMeta(item.stateKey).tone}"><span class="dot"></span>${escapeHtml(getSessionStateMeta(item.stateKey).label)}</span>
            <span class="health-badge health-badge--${getRiskMeta(item).tone}"><span class="dot"></span>${escapeHtml(getRiskMeta(item).label)}</span>
            ${item.isBaseline ? '<span class="health-badge health-badge--good"><span class="dot"></span>BASELINE</span>' : ''}
          </div>
          ${(item.note || item.engineerReason || item.actionTaken) ? `
            <div class="timeline-event-note">
              ${item.note ? `${escapeHtml(item.note)}<br>` : ''}
              ${item.engineerReason ? `<strong>Почему:</strong> ${escapeHtml(item.engineerReason)}<br>` : ''}
              ${item.actionTaken ? `<strong>Действие:</strong> ${escapeHtml(item.actionTaken)}` : ''}
            </div>` : ''}
        </div>
      </div>
    `).join('');
    node.innerHTML = `
      <div class="timeline-stage-row">
        ${stageOrder.map((stage) => {
          const reached = ascending.some((item) => item.stateKey === stage);
          const current = latestStage === stage;
          return `<div class="timeline-stage ${reached ? 'timeline-stage--reached' : ''} ${current ? 'timeline-stage--current' : ''}">
            <span>${escapeHtml(getSessionStateMeta(stage).label)}</span>
            <small>${escapeHtml(getSessionStateMeta(stage).note)}</small>
          </div>`;
        }).join('')}
      </div>
      <div class="timeline-flow-copy">
        <strong>Маршрут объекта:</strong> ${escapeHtml(journey.map((stage) => getSessionStateMeta(stage).label).join(' → '))}
      </div>
      <div class="timeline-event-list">${events}</div>
    `;
  }

  function renderAssetWorkflow() {
    const node = el('assetWorkflowSummary');
    if (!node) return;
    const asset = getAssetById(selectedAssetId);
    const overview = asset ? getAssetOverview(asset) : null;
    const latest = overview?.latest;
    if (!asset || !overview || !latest) {
      node.innerHTML = '<div class="workspace-empty-block">Выберите объект с историей инспекций, чтобы увидеть рекомендованный переход по жизненному циклу.</div>';
      return;
    }

    const stateKey = normalizeStateKey(latest.stateKey);
    const nextRepairReady = stateKey === 'warning' || latest.workStatus === 'inspect';
    const nextAfterReady = stateKey === 'service' || latest.workStatus === 'repair';
    const steps = [
      { key: 'warning', label: 'Warning', note: 'Диагноз подтверждён, нужен осмотр и фиксация дефекта.' },
      { key: 'service', label: 'Repair', note: 'Узел переведён в сервисный цикл или ремонт.' },
      { key: 'after_maintenance', label: 'After maintenance', note: 'После обслуживания выполняется контрольная инспекция.' },
    ];

    node.innerHTML = `
      <div class="asset-workflow-steps">
        ${steps.map((step) => {
          const reached = overview.stageTrail.includes(step.key);
          const current = stateKey === step.key;
          return `<div class="asset-workflow-step ${reached ? 'asset-workflow-step--done' : ''} ${current ? 'asset-workflow-step--active' : ''}">
            <strong>${escapeHtml(step.label)}</strong>
            <small>${escapeHtml(step.note)}</small>
          </div>`;
        }).join('')}
      </div>
      <div class="workspace-insight-note">
        <div><strong>Текущий узел:</strong> ${escapeHtml(asset.name)}</div>
        <div><strong>Последний рабочий статус:</strong> ${escapeHtml(overview.workMeta.label)}</div>
        <div><strong>Следующий шаг:</strong> ${
          nextRepairReady
            ? 'подготовить новую запись в статусе Repair и зафиксировать ремонтное действие.'
            : nextAfterReady
              ? 'подготовить контрольную запись After maintenance после завершения ремонта.'
              : 'узел находится в stable-state; при новом отклонении можно снова открыть warning-stage.'
        }</div>
      </div>
    `;

    if (el('assetPrepareRepairBtn')) el('assetPrepareRepairBtn').disabled = !latest || (!nextRepairReady && stateKey !== 'service');
    if (el('assetPrepareAfterBtn')) el('assetPrepareAfterBtn').disabled = !latest || !nextAfterReady;
  }

  function renderComparePanel() {
    const baselineSelect = el('compareBaselineSelect');
    const targetSelect = el('compareTargetSelect');
    const node = el('compareSummary');
    if (!baselineSelect || !targetSelect || !node) return;

    const sessions = getAssetSessions(selectedAssetId);
    const optionsHtml = sessions.map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(buildSessionOptionLabel(item))}</option>`).join('');
    baselineSelect.innerHTML = optionsHtml || '<option value="">Нет сеансов</option>';
    targetSelect.innerHTML = optionsHtml || '<option value="">Нет сеансов</option>';
    if (compareBaselineId) baselineSelect.value = compareBaselineId;
    if (compareTargetId) targetSelect.value = compareTargetId;

    const baseline = getInspectionById(compareBaselineId);
    const target = getInspectionById(compareTargetId);
    if (!baseline || !target) {
      node.innerHTML = '<div class="workspace-empty-block">Выберите два сеанса одного объекта, чтобы увидеть baseline vs defect или до/после ремонта.</div>';
      return;
    }
    const beforeMetrics = signalMetrics(baseline.signalData);
    const afterMetrics = signalMetrics(target.signalData);
    const rmsDelta = beforeMetrics.rms ? ((afterMetrics.rms - beforeMetrics.rms) / beforeMetrics.rms) * 100 : 0;
    const peakDelta = beforeMetrics.peak ? ((afterMetrics.peak - beforeMetrics.peak) / beforeMetrics.peak) * 100 : 0;
    node.innerHTML = `
      <div class="workspace-insight-grid workspace-insight-grid--compare">
        <div class="workspace-insight-metric">
          <span>Переход состояния</span>
          <strong>${escapeHtml(getSessionStateMeta(baseline.stateKey).label)} → ${escapeHtml(getSessionStateMeta(target.stateKey).label)}</strong>
          <small>${escapeHtml(getWorkStatusMeta(baseline.workStatus).label)} → ${escapeHtml(getWorkStatusMeta(target.workStatus).label)}</small>
        </div>
        <div class="workspace-insight-metric">
          <span>Диагноз</span>
          <strong>${escapeHtml(VM.RU[baseline.cls] || baseline.cls)} → ${escapeHtml(VM.RU[target.cls] || target.cls)}</strong>
          <small>${((baseline.confidence || 0) * 100).toFixed(1)}% → ${((target.confidence || 0) * 100).toFixed(1)}%</small>
        </div>
        <div class="workspace-insight-metric">
          <span>RMS сигнала</span>
          <strong>${beforeMetrics.rms.toFixed(3)} → ${afterMetrics.rms.toFixed(3)}</strong>
          <small>${rmsDelta >= 0 ? '+' : ''}${rmsDelta.toFixed(1)}%</small>
        </div>
        <div class="workspace-insight-metric">
          <span>Пиковая амплитуда</span>
          <strong>${beforeMetrics.peak.toFixed(3)} → ${afterMetrics.peak.toFixed(3)}</strong>
          <small>${peakDelta >= 0 ? '+' : ''}${peakDelta.toFixed(1)}%</small>
        </div>
      </div>
      <div class="workspace-insight-note">
        <div><strong>Baseline / before:</strong> ${escapeHtml(baseline.engineerReason || baseline.note || 'Комментарий не указан.')}</div>
        <div><strong>Target / after:</strong> ${escapeHtml(target.actionTaken || target.engineerReason || target.note || 'Комментарий не указан.')}</div>
      </div>
    `;
  }

  function renderReportPanel() {
    const select = el('reportSessionSelect');
    const node = el('reportSummary');
    const openBtn = el('openReportBtn');
    const copyBtn = el('copyReportLinkBtn');
    if (!select || !node || !openBtn || !copyBtn) return;

    const sessions = getAssetSessions(selectedAssetId);
    select.innerHTML = sessions.map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(buildSessionOptionLabel(item))}</option>`).join('') || '<option value="">Нет сеансов</option>';
    if (selectedReportInspectionId) select.value = selectedReportInspectionId;

    const inspection = getInspectionById(selectedReportInspectionId);
    if (!inspection) {
      openBtn.disabled = true;
      copyBtn.disabled = true;
      node.innerHTML = '<div class="workspace-empty-block">Выберите сеанс, чтобы сгенерировать share-link и открыть printable report.</div>';
      return;
    }

    const report = getReportByInspection(inspection.id);
    openBtn.disabled = !report?.shareUrl;
    copyBtn.disabled = !report?.shareUrl;
    node.innerHTML = report ? `
      <div class="workspace-insight-grid workspace-insight-grid--report">
        <div class="workspace-insight-metric">
          <span>Отчёт</span>
          <strong>${escapeHtml(report.title)}</strong>
          <small>${escapeHtml(formatStamp(report.updated_at || report.updatedAt || report.created_at || report.createdAt))}</small>
        </div>
        <div class="workspace-insight-metric">
          <span>Share link</span>
          <strong>${escapeHtml(report.shareUrl)}</strong>
          <small>Можно открыть отдельно или сохранить в PDF через печать.</small>
        </div>
      </div>
      <div class="workspace-insight-copy">${escapeHtml(report.summary || 'Сводка отчёта пока пустая.')}</div>
      ${report.payload?.baseline ? `
        <div class="workspace-insight-note">
          <strong>Baseline:</strong> ${escapeHtml(report.payload.baseline.input_label || report.payload.baseline.title || 'Эталонный сеанс')}
          · ${escapeHtml(VM.RU[report.payload.baseline.predicted_class] || report.payload.baseline.predicted_class || '—')}
        </div>` : ''}
      ${report.payload?.comparison ? `
        <div class="workspace-insight-note">
          <strong>Сравнение:</strong> RMS ${Number(report.payload.comparison.baseline_metrics?.rms || 0).toFixed(3)} → ${Number(report.payload.comparison.target_metrics?.rms || 0).toFixed(3)}
          · Peak ${Number(report.payload.comparison.baseline_metrics?.peak || 0).toFixed(3)} → ${Number(report.payload.comparison.target_metrics?.peak || 0).toFixed(3)}
        </div>` : ''}
      <div class="workspace-insight-note"><strong>Рекомендации:</strong> ${escapeHtml(report.recommendations || 'Не указаны.')}</div>
    ` : '<div class="workspace-empty-block">Для выбранного сеанса отчёт ещё не создан. Нажмите кнопку ниже, чтобы сформировать share-link.</div>';
  }

  function openAssetPage(assetId = selectedAssetId, inspectionId = null) {
    syncWorkspaceSelection(assetId || selectedAssetId, inspectionId || compareTargetId || selectedReportInspectionId);
    renderWorkspace();
    goPage('profile');
    window.setTimeout(() => el('journalPanel')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 120);
  }

  async function setBaselineInspection(inspectionId) {
    const inspection = getInspectionById(inspectionId);
    if (!inspection) {
      toast('Сеанс не найден', 'Не удалось найти выбранную запись в истории объекта.', 'warning');
      return null;
    }
    if (!apiReady || !authState?.id) {
      compareBaselineId = inspectionId;
      renderWorkspace();
      toast('Локальный baseline', 'Без серверной сессии baseline используется только в текущем окне для сравнения.', 'info');
      return inspection;
    }
    const updated = await apiRequest(`/inspections/${inspectionId}`, {
      method: 'PATCH',
      body: JSON.stringify({ is_baseline: true }),
    });
    compareBaselineId = updated.id;
    selectedAssetId = updated.asset_id || updated.assetId || selectedAssetId;
    await loadHistory();
    toast('Baseline обновлён', `Сеанс "${updated.input_label || updated.input?.label || 'Inspection'}" назначен эталоном объекта.`, 'success');
    return updated;
  }

  function prepareAssetTransition(targetStateKey, targetWorkStatus) {
    const latest = getLatestAssetSession(selectedAssetId);
    const asset = getAssetById(selectedAssetId);
    if (!latest || !asset) {
      toast('Нет базовой инспекции', 'Сначала выберите объект с сохранённой историей, чтобы подготовить следующий переход.', 'warning');
      return;
    }

    restoreSession(latest.id, 'open');
    window.setTimeout(() => {
      if (el('assetNameInput')) el('assetNameInput').value = asset.name;
      if (el('sessionStateInput')) el('sessionStateInput').value = targetStateKey;
      syncWorkStatusFromState(true);
      if (el('workStatusInput')) el('workStatusInput').value = targetWorkStatus;
      if (targetStateKey === 'service') {
        if (el('sessionNoteInput')) el('sessionNoteInput').value = 'Объект переведён в сервисный цикл после warning-stage.';
        if (el('engineerReasonInput')) el('engineerReasonInput').value = latest.engineerReason || 'Последний warning-сеанс подтвердил необходимость ремонтного вмешательства.';
        if (el('actionTakenInput')) el('actionTakenInput').value = 'Назначен ремонт и подготовлена следующая контрольная запись по объекту.';
      } else if (targetStateKey === 'after_maintenance') {
        if (el('sessionNoteInput')) el('sessionNoteInput').value = 'Контрольная запись после завершения ремонта.';
        if (el('engineerReasonInput')) el('engineerReasonInput').value = latest.actionTaken || 'Ремонт завершён, требуется подтвердить эффект обслуживания контрольной инспекцией.';
        if (el('actionTakenInput')) el('actionTakenInput').value = 'Узел возвращён в работу и переведён в after maintenance для контрольного сравнения.';
      }
      renderCaptureSummary();
      goPage('profile');
      window.setTimeout(() => el('journalPanel')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 120);
      toast('Шаблон перехода готов', `Для "${asset.name}" подготовлена следующая запись ${getSessionStateMeta(targetStateKey).label}.`, 'success');
    }, 180);
  }

  async function generateReportForInspection(inspectionId) {
    if (!apiReady || !authState?.id) {
      toast('Нужен вход', 'Отчёты доступны только в серверном кабинете.', 'warning');
      return null;
    }
    const report = await apiRequest(`/reports/from-inspection/${inspectionId}`, { method: 'POST' });
    const normalized = normalizeReports([report])[0];
    reportRegistry = [normalized, ...reportRegistry.filter((item) => item.id !== normalized.id)];
    selectedReportInspectionId = inspectionId;
    renderReportPanel();
    renderHistory();
    toast('Отчёт готов', 'Сформирован share-link и printable report по выбранному сеансу.', 'success');
    return normalized;
  }

  async function copyReportLink() {
    const report = getReportByInspection(selectedReportInspectionId);
    if (!report?.shareUrl) {
      toast('Нет ссылки', 'Сначала сформируйте отчёт для выбранного сеанса.', 'warning');
      return;
    }
    const absolute = new URL(report.shareUrl, window.location.origin).href;
    try {
      await navigator.clipboard.writeText(absolute);
      toast('Ссылка скопирована', absolute, 'success');
    } catch (e) {
      toast('Не удалось скопировать', 'Скопируйте ссылку вручную из карточки отчёта.', 'warning');
    }
  }

  function openReportLink() {
    const report = getReportByInspection(selectedReportInspectionId);
    if (!report?.shareUrl) {
      toast('Нет ссылки', 'Сначала сформируйте отчёт для выбранного сеанса.', 'warning');
      return;
    }
    window.open(new URL(report.shareUrl, window.location.origin).href, '_blank', 'noopener,noreferrer');
  }

  function guessMeasurementMimeType(name = '') {
    const lower = trimText(name).toLowerCase();
    if (lower.endsWith('.csv') || lower.endsWith('.txt') || lower.endsWith('.tsv') || lower.endsWith('.dat')) return 'text/plain';
    if (lower.endsWith('.wav')) return 'audio/wav';
    if (lower.endsWith('.json')) return 'application/json';
    if (lower.endsWith('.npy') || lower.endsWith('.npz')) return 'application/octet-stream';
    return 'application/octet-stream';
  }

  async function fileToBase64(file) {
    const buffer = await file.arrayBuffer();
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const chunkSize = 0x8000;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
    }
    return btoa(binary);
  }

  async function buildMeasurementUploadBody() {
    if (!currentDiagnosis || !currentSignalData?.data?.length) return null;
    if (currentInputContext?.type === 'demo') {
      throw new Error('Для monitoring-контура используйте реальный файл или сенсорную запись, а не demo-кейс.');
    }

    let originalName = currentSourceFile?.name || `${trimText(currentInputContext?.label || 'measurement').replace(/\s+/g, '_').toLowerCase() || 'measurement'}.csv`;
    let mimeType = currentSourceFile?.type || guessMeasurementMimeType(originalName);
    let contentBase64 = '';
    let sourceKind = currentInputContext?.type === 'sensor' ? 'sensor_capture' : 'uploaded_file';

    if (currentSourceFile) {
      contentBase64 = await fileToBase64(currentSourceFile);
    } else {
      const csv = ['index,value', ...Array.from(currentSignalData.data || []).map((value, index) => `${index},${Number(value).toFixed(8)}`)].join('\n');
      contentBase64 = btoa(unescape(encodeURIComponent(csv)));
      originalName = originalName.endsWith('.csv') ? originalName : `${originalName}.csv`;
      mimeType = 'text/csv';
    }

    return {
      asset_id: resolveAnalysisAsset()?.id || null,
      asset_name: getCurrentAssetName(),
      source_kind: sourceKind,
      source_label: currentDiagnosis.sourceLabel || 'Real monitoring',
      input_label: currentDiagnosis.input?.label || currentInputContext?.label || originalName,
      original_name: originalName,
      mime_type: mimeType,
      content_base64: contentBase64,
      sample_rate: currentSignalData.sampleRate || VM.FS,
      sample_count: currentSignalData.data.length,
      duration_seconds: currentSignalData.data.length / (currentSignalData.sampleRate || VM.FS),
      predicted_class: currentDiagnosis.cls,
      confidence: currentDiagnosis.confidence || 0,
      probabilities: { ...(currentDiagnosis.probabilities || {}) },
      input_context: { ...(currentDiagnosis.input || currentInputContext || {}) },
      preview_signal: compactSignal(currentSignalData.data),
      note: getCurrentSessionNote() || currentDiagnosis.playbook?.priority || '',
    };
  }

  async function uploadCurrentMeasurement() {
    if (!apiReady) {
      toast('API недоступен', 'Monitoring-контур работает только при активном backend.', 'warning');
      return null;
    }
    if (!authState?.id) {
      toast('Нужен вход', 'Сначала войдите в аккаунт, чтобы загрузить реальный файл в серверное хранилище.', 'warning');
      return null;
    }
    if (!currentDiagnosis) {
      toast('Нет анализа', 'Сначала выполните анализ сигнала, затем загрузите запись в monitoring.', 'warning');
      return null;
    }

    try {
      const payload = await buildMeasurementUploadBody();
      if (!payload) {
        toast('Нет данных', 'Для monitoring-записи нужен текущий сигнал и результат анализа.', 'warning');
        return null;
      }
      const created = await apiRequest('/measurements/upload', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      const measurement = normalizeMeasurements([created])[0];
      measurementRegistry = [measurement, ...measurementRegistry.filter((item) => item.id !== measurement.id)];
      currentInputContext = {
        ...currentInputContext,
        measurementId: measurement.id,
        sourceFile: measurement.originalName,
      };
      if (currentDiagnosis) {
        updateCurrentDiagnosis({
          ...currentDiagnosis,
          input: {
            ...(currentDiagnosis.input || {}),
            measurementId: measurement.id,
            label: currentDiagnosis.input?.label || currentInputContext.label,
          },
        });
      }
      await loadHistory();
      toast('Измерение сохранено', `Файл ${measurement.originalName} загружен в серверный monitoring-контур.`, 'success');
      return measurement;
    } catch (e) {
      toast('Не удалось загрузить', e.message || 'Ошибка при сохранении измерения на сервер.', 'error');
      return null;
    }
  }

  function openMeasurementDownload(measurementId) {
    const measurement = getMeasurementById(measurementId);
    if (!measurement?.downloadUrl) {
      toast('Нет файла', 'Для выбранного измерения недоступна ссылка на скачивание.', 'warning');
      return;
    }
    window.open(new URL(measurement.downloadUrl, window.location.origin).href, '_blank', 'noopener,noreferrer');
  }

  function openMeasurementInAnalysis(measurementId) {
    const measurement = getMeasurementById(measurementId);
    if (!measurement) return;
    if (measurement.inspectionId) {
      restoreSession(measurement.inspectionId, 'open');
      return;
    }

    goPage('diag');
    analysisCompareAssetId = measurement.assetId || analysisCompareAssetId;
    if (el('assetNameInput')) el('assetNameInput').value = measurement.assetName || getCurrentAssetName();
    currentSourceFile = null;
    currentInputContext = {
      ...(measurement.inputContext || {}),
      type: measurement.sourceKind === 'sensor_capture' ? 'sensor' : 'file',
      label: measurement.inputLabel || measurement.originalName,
      measurementId: measurement.id,
      sourceFile: measurement.originalName,
    };
    currentSignalData = {
      data: Array.isArray(measurement.previewSignal) ? measurement.previewSignal : [],
      sampleRate: measurement.sampleRate || VM.FS,
    };
    activateScenarioCards(null);
    document.querySelectorAll('.fault-btn').forEach((b) => b.classList.remove('active'));
    litPipeline(5);
    if (currentStop) currentStop();

    const signal = Array.from(measurement.previewSignal || []);
    if (!signal.length) {
      toast('Нет preview-сигнала', 'Для этого измерения пока не сохранён preview, поэтому открыть его в analysis нельзя.', 'warning');
      return;
    }

    const diagClass = measurement.predictedClass || 'normal';
    const diagColor = VM.COLORS[diagClass] || '#00e5ff';
    currentStop = Viz.drawSignal('sigCanvas', signal, diagColor, true);
    Viz.addCrosshair(el('sigCanvas'), { type: 'signal', data: signal, sampleRate: measurement.sampleRate || VM.FS, color: diagColor });
    const { freqs, spectrum } = FFT.computeSpectrum(signal, measurement.sampleRate || VM.FS);
    Viz.drawSpectrum('specCanvas', freqs, spectrum, diagColor);
    Viz.addCrosshair(el('specCanvas'), { type: 'spectrum', data: spectrum, freqs, color: diagColor });
    el('sigStatus').textContent = '● MONITORING';
    el('sigStatus').style.color = diagColor;
    el('specStatus').textContent = 'SERVER';
    el('specStatus').style.color = diagColor;
    const sigBaseText = `${measurement.originalName} | ${measurement.sampleRate} Hz | ${(measurement.durationSeconds || (signal.length / (measurement.sampleRate || VM.FS))).toFixed(3)}с`;
    const specBaseText = `Server measurement · ${measurement.sourceLabel}`;
    el('sigDesc').textContent = sigBaseText;
    el('specDesc').textContent = specBaseText;
    el('sigDesc').dataset.baseText = sigBaseText;
    el('specDesc').dataset.baseText = specBaseText;
    showDiagnosis(
      diagClass,
      measurement.probabilities && Object.keys(measurement.probabilities).length ? measurement.probabilities : { [diagClass]: measurement.confidence || 1 },
      diagColor,
      signal,
    );
    toast('Измерение открыто', `Серверная запись ${measurement.originalName} загружена в analysis.`, 'success');
  }

  function renderMonitoringFeed() {
    const listNode = el('monitoringList');
    const emptyNode = el('monitoringEmpty');
    const statsNode = el('monitoringStats');
    if (!listNode || !emptyNode || !statsNode) return;

    if (!apiReady || !authState?.id) {
      statsNode.innerHTML = '';
      emptyNode.style.display = 'block';
      emptyNode.textContent = 'Войдите в серверный кабинет, чтобы сохранять реальные файлы и видеть журнал измерений.';
      listNode.innerHTML = '';
      return;
    }

    const resolvedAsset = resolveAnalysisAsset() || getAssetById(selectedAssetId) || assetRegistry[0] || null;
    const filtered = resolvedAsset ? getAssetMeasurements(resolvedAsset.id) : measurementRegistry;
    statsNode.innerHTML = `
      <span class="workspace-stat-pill">${filtered.length} записей</span>
      <span class="workspace-stat-pill">${measurementRegistry.length} всего в журнале</span>
      <span class="workspace-stat-pill">${resolvedAsset ? escapeHtml(resolvedAsset.name) : 'Все записи'}</span>
    `;

    if (!filtered.length) {
      emptyNode.style.display = 'block';
      emptyNode.textContent = resolvedAsset
        ? `Для "${resolvedAsset.name}" ещё нет серверных измерений. Загрузите реальный файл на этой странице.`
        : 'Журнал измерений пока пуст. Загрузите реальный файл после анализа.';
      listNode.innerHTML = '';
      return;
    }

    emptyNode.style.display = 'none';
    listNode.innerHTML = filtered.slice(0, 8).map((item) => {
      const cls = item.predictedClass;
      const color = cls ? (VM.COLORS[cls] || '#fff') : '#c6d1de';
      const diagnosis = cls ? (VM.RU[cls] || cls) : 'Диагноз не привязан';
      return `<article class="monitoring-item">
        <div class="monitoring-item-head">
          <div>
            <div class="monitoring-item-title">${escapeHtml(item.originalName)}</div>
            <div class="monitoring-item-meta">${escapeHtml(item.assetName)} · ${escapeHtml(formatStamp(item.createdAt))}</div>
          </div>
          <div class="history-badge-stack">
            <span class="health-badge"><span class="dot"></span>${escapeHtml(item.sourceKind)}</span>
            ${item.inspectionId ? '<span class="health-badge health-badge--good"><span class="dot"></span>LINKED</span>' : '<span class="health-badge health-badge--warning"><span class="dot"></span>RAW</span>'}
          </div>
        </div>
        <div class="history-item-grid">
          <div class="history-item-card">
            <div class="label">ДИАГНОЗ</div>
            <div style="color:${color};font-size:15px;line-height:1.6">${escapeHtml(diagnosis)}</div>
          </div>
          <div class="history-item-card">
            <div class="label">Fs / ДЛИТЕЛЬНОСТЬ</div>
            <div style="color:#fff;font-size:15px;line-height:1.6">${item.sampleRate.toFixed(0)} Hz · ${(item.durationSeconds || 0).toFixed(3)} c</div>
          </div>
          <div class="history-item-card">
            <div class="label">РАЗМЕР / ОТСЧЁТЫ</div>
            <div style="color:#fff;font-size:15px;line-height:1.6">${Math.max(1, Math.round(item.storageSize / 1024))} KB · ${item.sampleCount}</div>
          </div>
        </div>
        ${item.note ? `<div class="history-item-note">${escapeHtml(item.note)}</div>` : ''}
        <div class="history-item-actions">
          <button class="history-btn" type="button" data-measurement-action="open" data-measurement-id="${escapeHtml(item.id)}">ОТКРЫТЬ</button>
          <button class="history-btn" type="button" data-measurement-action="download" data-measurement-id="${escapeHtml(item.id)}">СКАЧАТЬ</button>
        </div>
      </article>`;
    }).join('');
  }

  function toast(title, message, tone = 'info') {
    const host = el('toastContainer');
    if (!host) return;
    const icons = {
      info: 'ℹ',
      success: '✓',
      warning: '!',
      error: '✕',
    };
    const node = document.createElement('div');
    node.className = `toast toast--${tone}`;
    node.innerHTML = `
      <div class="toast__icon">${icons[tone] || icons.info}</div>
      <div class="toast__body">
        <div class="toast__title">${escapeHtml(title)}</div>
        <div class="toast__message">${escapeHtml(message)}</div>
      </div>
      <button class="toast__close" type="button" aria-label="Закрыть">×</button>
    `;
    host.appendChild(node);
    const close = () => {
      node.classList.add('out');
      window.setTimeout(() => node.remove(), 260);
    };
    node.querySelector('.toast__close')?.addEventListener('click', close);
    window.setTimeout(close, 3200);
  }

  function compactSignal(signal) {
    return Array.from(signal || [])
      .slice(0, STORAGE_LIMITS.signalSamples)
      .map(value => Number(Number(value).toFixed(6)));
  }

  function updateCurrentDiagnosis(payload) {
    currentDiagnosis = payload;
    renderCaptureSummary();
    renderAnalysisComparePanel();
  }

  function clearCurrentDiagnosis() {
    currentDiagnosis = null;
    renderCaptureSummary();
    renderAnalysisComparePanel();
  }

  function buildSessionRecord() {
    if (!currentDiagnosis) return null;
    const stateKey = getCurrentSessionState();
    const stateMeta = getSessionStateMeta(stateKey);
    const workStatus = getCurrentWorkStatus();
    const workMeta = getWorkStatusMeta(workStatus);
    return {
      asset_name: getCurrentAssetName(),
      measurement_id: currentDiagnosis.input?.measurementId || currentInputContext?.measurementId || null,
      title: currentDiagnosis.input?.label || null,
      state_key: stateKey,
      state_label: stateMeta.label,
      work_status: workStatus,
      work_status_label: workMeta.label,
      is_baseline: shouldAutoMarkBaseline(),
      note: getCurrentSessionNote(),
      engineer_reason: getCurrentEngineerReason(),
      action_taken: getCurrentActionTaken(),
      predicted_class: currentDiagnosis.cls,
      confidence: currentDiagnosis.confidence,
      probabilities: { ...currentDiagnosis.probabilities },
      source_label: currentDiagnosis.sourceLabel,
      input_type: currentDiagnosis.input?.type || 'demo',
      input_label: currentDiagnosis.input?.label || 'Session',
      input_context: currentDiagnosis.input,
      playbook: currentDiagnosis.playbook,
      signal_data: compactSignal(currentDiagnosis.signalData),
      sample_rate: currentDiagnosis.sampleRate || VM.FS,
    };
  }

  function fillJournalFields(session) {
    if (!session) return;
    if (el('assetNameInput')) el('assetNameInput').value = session.assetName || '';
    if (el('sessionStateInput')) el('sessionStateInput').value = session.stateKey || 'warning';
    if (el('workStatusInput')) el('workStatusInput').value = session.workStatus || 'observe';
    if (el('sessionNoteInput')) el('sessionNoteInput').value = session.note || '';
    if (el('engineerReasonInput')) el('engineerReasonInput').value = session.engineerReason || '';
    if (el('actionTakenInput')) el('actionTakenInput').value = session.actionTaken || '';
    renderCaptureSummary();
  }

  function openJournal() {
    goPage('profile');
    window.setTimeout(() => el('journalPanel')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
  }

  async function saveCurrentSession() {
    if (!apiReady) {
      toast('API недоступен', 'Сначала запустите FastAPI backend, чтобы сохранять сеансы в серверную базу.', 'warning');
      return false;
    }
    if (!authState?.id) {
      toast('Нужен вход', 'Сначала войдите в аккаунт, чтобы сохранить сеанс в базу.', 'warning');
      goPage('profile');
      window.setTimeout(() => el('authPanel')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
      return false;
    }
    if (!currentDiagnosis) {
      toast('Нет активного анализа', 'Сначала выполните анализ сигнала или запустите demo-сценарий.', 'warning');
      return false;
    }

    const record = buildSessionRecord();
    if (!record) return false;
    try {
      const created = await apiRequest('/inspections', {
        method: 'POST',
        body: JSON.stringify(record),
      });
      syncWorkspaceSelection(created.asset_id || created.assetId, created.id);
      await loadHistory();
    } catch (e) {
      toast('Не удалось сохранить', e.message || 'Ошибка при сохранении сеанса в базе.', 'error');
      return false;
    }

    toast('Сеанс сохранён', `Запись для "${record.asset_name}" добавлена в серверный журнал.`, 'success');
    return true;
  }

  function restoreSession(sessionId, mode = 'open', options = {}) {
    const { silent = false, skipScroll = false } = options;
    const session = sessionHistory.find(item => item.id === sessionId);
    if (!session) return;

    fillJournalFields(session);
    analysisCompareAssetId = session.assetId || analysisCompareAssetId;
    syncWorkspaceSelection(session.assetId, session.id);
    selectedReportInspectionId = session.id;
    renderWorkspace();

    if (mode === 'reuse') {
      toast('Поля заполнены', 'Контекст объекта и комментарий перенесены в форму текущего сеанса.', 'info');
      openJournal();
      return;
    }

    goPage('diag');
    currentSourceFile = null;
    currentInputContext = {
      ...(session.input || { type: 'saved', label: 'Сохранённый сеанс' }),
      sessionId: session.id,
      label: session.input?.label || session.title || 'Сохранённый сеанс',
    };
    activateScenarioCards(session.input?.scenario || null);
    document.querySelectorAll('.fault-btn').forEach(b => b.classList.toggle('active', b.dataset.cls === session.cls));
    litPipeline(5);

    const signal = Array.isArray(session.signalData) ? session.signalData : [];
    currentSignalData = { data: signal, sampleRate: session.sampleRate || VM.FS };
    if (currentStop) currentStop();
    if (signal.length) {
      currentStop = Viz.drawSignal('sigCanvas', signal, VM.COLORS[session.cls], true);
      Viz.addCrosshair(el('sigCanvas'), {
        type: 'signal',
        data: signal,
        sampleRate: session.sampleRate || VM.FS,
        color: VM.COLORS[session.cls],
      });
      const { freqs, spectrum } = FFT.computeSpectrum(signal, session.sampleRate || VM.FS);
      Viz.drawSpectrum('specCanvas', freqs, spectrum, VM.COLORS[session.cls]);
      Viz.addCrosshair(el('specCanvas'), { type: 'spectrum', data: spectrum, freqs, color: VM.COLORS[session.cls] });
      el('sigStatus').textContent = '● ЖУРНАЛ';
      el('sigStatus').style.color = VM.COLORS[session.cls];
      el('specStatus').textContent = 'READY';
      el('specStatus').style.color = VM.COLORS[session.cls];
      const restoreSigBaseText = `${session.input?.label || 'Сохранённый сеанс'} | ${(signal.length / (session.sampleRate || VM.FS)).toFixed(3)}с`;
      const restoreSpecBaseText = `Восстановленный спектр | ${(session.sampleRate || VM.FS) / 2} Гц`;
      el('sigDesc').textContent = restoreSigBaseText;
      el('specDesc').textContent = restoreSpecBaseText;
      el('sigDesc').dataset.baseText = restoreSigBaseText;
      el('specDesc').dataset.baseText = restoreSpecBaseText;
    }

    showDiagnosis(session.cls, session.probabilities || { [session.cls]: session.confidence || 1 }, VM.COLORS[session.cls], signal);
    if (!silent) {
      toast('Сеанс открыт', `Восстановлена запись от ${formatStamp(session.savedAt)}.`, 'success');
    }
    if (!skipScroll) {
      window.setTimeout(() => el('diagResult')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 140);
    }
  }

  async function deleteSession(sessionId) {
    try {
      await apiRequest(`/inspections/${sessionId}`, { method: 'DELETE' });
      await loadHistory();
      toast('Запись удалена', 'Сеанс удалён из серверного журнала.', 'info');
    } catch (e) {
      toast('Не удалось удалить', e.message || 'Ошибка при удалении сеанса.', 'error');
    }
  }

  async function handleAuthSubmit(event) {
    event.preventDefault();
    const name = trimText(el('authNameInput')?.value);
    const email = trimText(el('authEmailInput')?.value).toLowerCase();
    const password = trimText(el('authPasswordInput')?.value);
    if (!name) {
      toast('Нужно имя', 'Укажите имя пользователя для регистрации.', 'warning');
      el('authNameInput')?.focus();
      return;
    }
    if (!email.includes('@')) {
      toast('Неверный email', 'Укажите корректный email для входа в систему.', 'warning');
      el('authEmailInput')?.focus();
      return;
    }
    if (!password || password.length < 8) {
      toast('Пароль слишком короткий', 'Для серверного аккаунта используйте пароль длиной от 8 символов.', 'warning');
      el('authPasswordInput')?.focus();
      return;
    }
    try {
      const payload = await apiRequest('/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          email,
          password,
          display_name: name,
          role: 'operator',
        }),
      });
      authState = normalizeAuth({
        ...payload.user,
        session_id: payload.session?.id,
        session_expires_at: payload.session?.expires_at,
      });
      renderAuthSummary();
      updateHeaderProfile();
      renderCaptureSummary();
      await loadHistory();
      toast('Аккаунт создан', `Профиль ${name} зарегистрирован и готов к работе.`, 'success');
    } catch (e) {
      toast('Не удалось зарегистрироваться', e.message || 'Ошибка регистрации.', 'error');
    }
  }

  async function handleLogin() {
    const email = trimText(el('authEmailInput')?.value).toLowerCase();
    const password = trimText(el('authPasswordInput')?.value);
    if (!email || !password) {
      toast('Нужны данные для входа', 'Введите email и пароль, чтобы открыть серверный кабинет.', 'warning');
      return;
    }
    try {
      const payload = await apiRequest('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      authState = normalizeAuth({
        ...payload.user,
        session_id: payload.session?.id,
        session_expires_at: payload.session?.expires_at,
      });
      renderAuthSummary();
      updateHeaderProfile();
      renderCaptureSummary();
      await loadHistory();
      toast('Вход выполнен', `Серверный кабинет открыт для ${authState.name}.`, 'success');
    } catch (e) {
      toast('Не удалось войти', e.message || 'Ошибка авторизации.', 'error');
    }
  }

  async function handleLogout() {
    if (apiReady) {
      try {
        await apiRequest('/auth/logout', { method: 'POST' });
      } catch (e) {
        console.warn('[APP] logout failed:', e);
      }
    }
    authState = normalizeAuth(null);
    sessionHistory = [];
    assetRegistry = [];
    measurementRegistry = [];
    reportRegistry = [];
    dashboardSummary = null;
    selectedAssetId = null;
    compareBaselineId = null;
    compareTargetId = null;
    analysisCompareAssetId = null;
    analysisCompareReferenceId = null;
    analysisCompareTargetId = '__current';
    analysisCompareMode = 'baseline_current';
    selectedReportInspectionId = null;
    updateHeaderProfile();
    renderAuthSummary();
    renderWorkspace();
    toast('Выход выполнен', 'Серверная сессия завершена.', 'info');
  }

  function setupCabinetUI() {
    el('headerProfileChip')?.addEventListener('click', openJournal);
    el('authForm')?.addEventListener('submit', handleAuthSubmit);
    el('authLoginBtn')?.addEventListener('click', handleLogin);
    el('authImportBtn')?.addEventListener('click', () => { importLegacySessions().catch((e) => {
      toast('Импорт не выполнен', e.message || 'Ошибка импорта локального журнала.', 'error');
    }); });
    el('authLogoutBtn')?.addEventListener('click', handleLogout);
    el('historyList')?.addEventListener('click', (event) => {
      const btn = event.target.closest('[data-action][data-id]');
      if (!btn) return;
      const { action, id } = btn.dataset;
      if (action === 'open') restoreSession(id, 'open');
      if (action === 'reuse') restoreSession(id, 'reuse');
      if (action === 'asset') {
        const assetId = getInspectionById(id)?.assetId;
        selectedReportInspectionId = id;
        openAssetPage(assetId, id);
      }
      if (action === 'baseline') {
        setBaselineInspection(id).catch((e) => {
          toast('Не удалось назначить baseline', e.message || 'Ошибка при обновлении эталонного сеанса.', 'error');
        });
      }
      if (action === 'compare') {
        compareTargetId = id;
        selectedReportInspectionId = id;
        syncWorkspaceSelection(getInspectionById(id)?.assetId, id);
        renderWorkspace();
      }
      if (action === 'report') {
        selectedAssetId = getInspectionById(id)?.assetId || selectedAssetId;
        selectedReportInspectionId = id;
        syncWorkspaceSelection(selectedAssetId, id);
        renderWorkspace();
        generateReportForInspection(id).catch((e) => {
          toast('Не удалось создать отчёт', e.message || 'Ошибка генерации отчёта.', 'error');
        });
      }
      if (action === 'delete') deleteSession(id).catch((e) => {
        toast('Не удалось удалить', e.message || 'Ошибка при удалении записи.', 'error');
      });
    });
    el('monitoringList')?.addEventListener('click', (event) => {
      const btn = event.target.closest('[data-measurement-action][data-measurement-id]');
      if (!btn) return;
      const measurementId = btn.dataset.measurementId;
      const action = btn.dataset.measurementAction;
      if (action === 'open') openMeasurementInAnalysis(measurementId);
      if (action === 'download') openMeasurementDownload(measurementId);
      if (action === 'asset') {
        const assetId = getMeasurementById(measurementId)?.assetId;
        if (assetId) openAssetPage(assetId);
      }
    });
    ['assetNameInput', 'sessionNoteInput', 'engineerReasonInput', 'actionTakenInput'].forEach((id) => {
      el(id)?.addEventListener('input', renderCaptureSummary);
      el(id)?.addEventListener('change', renderCaptureSummary);
    });
    el('sessionStateInput')?.addEventListener('change', () => {
      syncWorkStatusFromState(true);
      renderCaptureSummary();
    });
    el('workStatusInput')?.addEventListener('change', () => {
      const work = trimText(el('workStatusInput')?.value);
      const stateNode = el('sessionStateInput');
      if (stateNode && work === 'repair') stateNode.value = 'service';
      if (stateNode && work === 'replaced') stateNode.value = 'after_maintenance';
      if (stateNode && work === 'observe' && stateNode.value === 'service') stateNode.value = 'healthy';
      renderCaptureSummary();
    });
    el('assetFocusSelect')?.addEventListener('change', (event) => {
      selectedAssetId = event.target.value || null;
      const asset = getAssetById(selectedAssetId);
      if (asset && el('assetNameInput') && !trimText(el('assetNameInput').value)) {
        el('assetNameInput').value = asset.name;
      }
      syncWorkspaceSelection(selectedAssetId);
      renderWorkspace();
    });
    el('compareBaselineSelect')?.addEventListener('change', (event) => {
      compareBaselineId = event.target.value || null;
      renderComparePanel();
    });
    el('compareTargetSelect')?.addEventListener('change', (event) => {
      compareTargetId = event.target.value || null;
      selectedReportInspectionId = compareTargetId;
      renderComparePanel();
      renderReportPanel();
    });
    el('analysisCompareAssetSelect')?.addEventListener('change', (event) => {
      analysisCompareAssetId = event.target.value || null;
      applyAnalysisCompareMode(analysisCompareMode, { force: true, openTarget: true });
    });
    el('analysisCompareModeSelect')?.addEventListener('change', (event) => {
      applyAnalysisCompareMode(event.target.value || 'baseline_current', { force: true, openTarget: true });
    });
    el('analysisCompareReferenceSelect')?.addEventListener('change', (event) => {
      analysisCompareReferenceId = event.target.value || null;
      renderAnalysisComparePanel();
      rerenderActiveDiagnosis();
    });
    el('analysisCompareTargetSelect')?.addEventListener('change', (event) => {
      analysisCompareTargetId = event.target.value || '__current';
      renderAnalysisComparePanel();
      if (analysisCompareTargetId !== '__current') {
        restoreSession(analysisCompareTargetId, 'open', { silent: true, skipScroll: true });
      } else {
        rerenderActiveDiagnosis();
      }
    });
    el('analysisComparePanel')?.addEventListener('click', (event) => {
      const button = event.target.closest('[data-analysis-compare-preset]');
      if (!button) return;
      applyAnalysisCompareMode(button.dataset.analysisComparePreset || 'baseline_current', { force: true, openTarget: true });
    });
    el('reportSessionSelect')?.addEventListener('change', (event) => {
      selectedReportInspectionId = event.target.value || null;
      renderReportPanel();
    });
    el('generateReportBtn')?.addEventListener('click', () => {
      if (!selectedReportInspectionId) return;
      generateReportForInspection(selectedReportInspectionId).catch((e) => {
        toast('Не удалось создать отчёт', e.message || 'Ошибка генерации отчёта.', 'error');
      });
    });
    el('copyReportLinkBtn')?.addEventListener('click', () => {
      copyReportLink().catch((e) => {
        toast('Не удалось скопировать', e.message || 'Ошибка буфера обмена.', 'warning');
      });
    });
    el('openReportBtn')?.addEventListener('click', openReportLink);
    el('assetFleetList')?.addEventListener('click', (event) => {
      const card = event.target.closest('[data-asset-card]');
      if (!card) return;
      selectedAssetId = card.dataset.assetCard || null;
      syncWorkspaceSelection(selectedAssetId);
      renderWorkspace();
    });
    el('assetSearchInput')?.addEventListener('input', (event) => {
      assetSearchQuery = event.target.value || '';
      renderAssetFleet();
    });
    el('assetStatusFilter')?.addEventListener('change', (event) => {
      assetStatusFilter = event.target.value || 'all';
      renderAssetFleet();
    });
    el('assetRiskFilter')?.addEventListener('change', (event) => {
      assetRiskFilter = event.target.value || 'all';
      renderAssetFleet();
    });
    el('assetSortSelect')?.addEventListener('change', (event) => {
      assetSortMode = event.target.value || 'priority';
      renderAssetFleet();
    });
    el('assetPrepareRepairBtn')?.addEventListener('click', () => prepareAssetTransition('service', 'repair'));
    el('assetPrepareAfterBtn')?.addEventListener('click', () => prepareAssetTransition('after_maintenance', 'replaced'));
    el('assetOpenJournalBtn')?.addEventListener('click', openJournal);
    if (el('assetNameInput') && !el('assetNameInput').value) {
      el('assetNameInput').value = sessionHistory[0]?.assetName || 'Gearbox A-01';
    }
    if (el('sessionStateInput') && !el('sessionStateInput').value) {
      el('sessionStateInput').value = 'warning';
    }
    if (el('workStatusInput') && !el('workStatusInput').value) {
      el('workStatusInput').value = 'observe';
    }
    syncWorkStatusFromState();
    updateHeaderProfile();
    renderAuthSummary();
    syncWorkspaceSelection();
    renderWorkspace();
    renderCaptureSummary();
  }

  function syncHeroMeta(metaObj) {
    if (!metaObj) return;
    const sampleCount = (metaObj.train_size || 0) + (metaObj.test_size || 0);
    const featureCount = metaObj.n_features || metaObj.n_features_selected || metaObj.feature_names?.length || 0;
    const setText = (id, value) => { const node = el(id); if (node) node.textContent = value; };

    setText('heroAccValue', `${(metaObj.accuracy * 100).toFixed(1)}%`);
    setText('heroClassValue', String(metaObj.classes?.length || 0));
    setText('heroSampleValue', sampleCount ? String(sampleCount) : '—');
    setText('heroSourceLine', VM.sourceLabel(metaObj));
    setText('heroModelSource', VM.sourceLabel(metaObj));
    setText('heroFeatureValue', String(featureCount || '—'));
    setText('heroClassValueStage', String(metaObj.classes?.length || 0));
  }

  function activateScenarioCards(cls) {
    document.querySelectorAll('[data-demo-class]').forEach(node => {
      node.classList.toggle('active-demo', node.dataset.demoClass === cls);
    });
  }

  function runScenario(cls) {
    goPage('diag');
    window.setTimeout(() => runDemo(cls), 220);
  }

  function setupScenarioLinks() {
    document.querySelectorAll('[data-demo-class]').forEach(node => {
      node.addEventListener('click', () => runScenario(node.dataset.demoClass));
    });
  }

  function initRevealSystem() {
    const targets = [
      '.hero-copy',
      '.hero-stage',
      '.sales-strip',
      '.metric-card',
      '.fault-card',
      '.diag-lead',
      '.diag-presets',
      '.upload-zone',
      '.sensor-panel',
      '.fault-btn',
      '.analysis-compare-panel',
      '.signal-box',
      '.card',
      '.assets-hero-copy',
      '.assets-hero-metrics',
      '.asset-fleet-card',
    ];
    const nodes = [...new Set(targets.flatMap(selector => [...document.querySelectorAll(selector)]))];
    if (!nodes.length) return;

    nodes.forEach((node, index) => {
      node.classList.add('reveal');
      node.style.setProperty('--reveal-delay', `${Math.min(index % 6, 5) * 55}ms`);
    });

    if (!('IntersectionObserver' in window)) {
      nodes.forEach(node => node.classList.add('is-visible'));
      return;
    }

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.14 });

    nodes.forEach(node => observer.observe(node));
  }

  // ═══ NAV ═══
  function goPage(id) {
    ['home', 'diag', 'profile', 'assets'].forEach(p => {
      const e = el('page-'+p); if(e) e.style.display = p===id ? 'block' : 'none';
    });
    document.querySelectorAll('.nav-btn').forEach(b => {
      const isActive = b.dataset.page===id;
      b.classList.toggle('active', isActive);
      if(isActive) b.setAttribute('aria-current','page'); else b.removeAttribute('aria-current');
    });
    window.scrollTo({top:0,behavior:'smooth'});
  }

  function goHomeSection(sectionId) {
    const scrollToSection = () => {
      const target = el(sectionId);
      if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };
    goPage('home');
    window.setTimeout(scrollToSection, 80);
  }

  function goPageSection(pageId, sectionId) {
    const scrollToSection = () => {
      const target = el(sectionId);
      if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    const pageEl = el(`page-${pageId}`);
    const isVisible = pageId === 'home'
      ? !!pageEl && pageEl.style.display !== 'none'
      : !!pageEl && pageEl.style.display === 'block';

    if (!isVisible) {
      goPage(pageId);
      window.setTimeout(scrollToSection, 90);
      return;
    }

    scrollToSection();
  }

  function litPipeline(step) {
    for(let i=1;i<=5;i++){const e=el('ps'+i);if(e)e.classList.toggle('lit',i<=step);}
  }

  // ═══ DEMO ═══
  function runDemo(cls) {
    if(diagLocked) return;
    diagLocked = true;
    if(currentStop) currentStop();
    clearCurrentDiagnosis();
    currentSourceFile = null;
    const demoCase = typeof DemoCases !== 'undefined' ? DemoCases.get(cls) : null;
    currentInputContext = {
      type: 'demo',
      scenario: cls,
      label: demoCase ? `SEU Demo · ${VM.RU[cls] || cls}` : `Demo · ${VM.RU[cls] || cls}`,
      sourceFile: demoCase?.source_file || null,
      measurementId: null,
    };
    activateScenarioCards(cls);
    document.querySelectorAll('.fault-btn').forEach(b=>b.classList.toggle('active',b.dataset.cls===cls));
    litPipeline(0);
    const color = VM.COLORS[cls];
    el('sigStatus').textContent='—'; el('specStatus').textContent='—';
    el('sigDesc').textContent=''; el('specDesc').textContent='';
    if (el('sigDesc')) el('sigDesc').dataset.baseText = '';
    if (el('specDesc')) el('specDesc').dataset.baseText = '';
    el('diagResult').classList.remove('show');
    Viz.clear('sigCanvas'); Viz.clear('specCanvas');

    setTimeout(()=>{
      litPipeline(1);
      el('sigStatus').textContent='● LIVE'; el('sigStatus').style.color=color;
      const sig = demoCase?.signal?.length ? Float64Array.from(demoCase.signal) : SignalGen.generate(cls);
      currentStop = Viz.drawSignal('sigCanvas',sig,color,true);
      Viz.addCrosshair(el('sigCanvas'), {type:'signal', data:sig, sampleRate:VM.FS, color});
      const sigBaseText = demoCase
        ? `${VM.DESCRIPTIONS[cls].sig} Эталонный SEU-сегмент · ${demoCase.source_file?.split('/').slice(-2).join(' / ') || 'reference case'}`
        : VM.DESCRIPTIONS[cls].sig;
      el('sigDesc').textContent = sigBaseText;
      el('sigDesc').dataset.baseText = sigBaseText;
      currentSignalData={data:sig,sampleRate:demoCase?.sample_rate || VM.FS};

      setTimeout(()=>{
        litPipeline(2); el('specStatus').textContent='БПФ...'; el('specStatus').style.color='#fbbf24';
        setTimeout(()=>{
          litPipeline(3); el('specStatus').textContent='READY'; el('specStatus').style.color=color;
          const{freqs,spectrum}=FFT.computeSpectrum(sig);
          Viz.drawSpectrum('specCanvas',freqs,spectrum,color);
          Viz.addCrosshair(el('specCanvas'), {type:'spectrum', data:spectrum, freqs, color});
          const specBaseText = demoCase
            ? `${VM.DESCRIPTIONS[cls].spec} Готовый кейс привязан к реальному сегменту из SEU.`
            : VM.DESCRIPTIONS[cls].spec;
          el('specDesc').textContent = specBaseText;
          el('specDesc').dataset.baseText = specBaseText;
          setTimeout(()=>{
            litPipeline(4);
            setTimeout(()=>{
              litPipeline(5);
              if(Model.isLoaded()){
                const live = Model.diagnose(sig);
                if (demoCase?.predicted_class && demoCase?.probabilities) {
                  const demoCls = demoCase.predicted_class;
                  const demoProbs = demoCase.probabilities;
                  const demoRf = {
                    ...live,
                    cls: demoCls,
                    confidence: demoCase.confidence || demoProbs[demoCls] || live.confidence,
                    probabilities: demoProbs,
                  };
                  showDiagnosis(demoCls, demoProbs, VM.COLORS[demoCls], sig, live.features);
                  showAdvancedDiagnosis(sig, live.features, demoRf);
                } else {
                  showDiagnosis(live.cls, live.probabilities, VM.COLORS[live.cls], sig, live.features);
                  showAdvancedDiagnosis(sig, live.features, live);
                }
              } else { showDiagFake(cls,color); }
              diagLocked=false;
            },400);
          },350);
        },400);
      },350);
    },200);
  }

  function detectStructuredClassHint(title = '', fallbackName = '') {
    const probe = `${title} ${fallbackName}`.toLowerCase();
    if (!probe.trim()) return null;
    if (probe.includes('health')) return 'normal';
    if (probe.includes('chipped') || probe.includes('chip') || /(^|[\W_])c(_|\d|$)/.test(probe)) return 'tooth_chip';
    if (probe.includes('miss') || /(^|[\W_])m(_|\d|$)/.test(probe)) return 'tooth_miss';
    if (probe.includes('root') || probe.includes('crack') || /(^|[\W_])r(_|\d|$)/.test(probe)) return 'root_crack';
    if (probe.includes('surface') || probe.includes('wear') || /(^|[\W_])s(_|\d|$)/.test(probe)) return 'surface_wear';
    if (probe.includes('ball')) return 'ball_fault';
    if (probe.includes('inner')) return 'inner_race';
    if (probe.includes('outer')) return 'outer_race';
    if (probe.includes('comb')) return 'combination';
    return null;
  }

  function getWindowStartPositions(totalLength, segmentLength, maxWindows = 12) {
    const totalSegments = Math.floor(totalLength / segmentLength);
    if (totalSegments <= 1) return [0];
    if (totalSegments <= maxWindows) {
      return Array.from({ length: totalSegments }, (_, index) => index * segmentLength);
    }

    const seen = new Set();
    const starts = [];
    for (let index = 0; index < maxWindows; index++) {
      const ratio = maxWindows === 1 ? 0 : index / (maxWindows - 1);
      const segmentIndex = Math.round(ratio * (totalSegments - 1));
      if (seen.has(segmentIndex)) continue;
      seen.add(segmentIndex);
      starts.push(segmentIndex * segmentLength);
    }
    return starts.sort((a, b) => a - b);
  }

  function analyzeSegmentedFile(signal, sampleRate, meta = {}) {
    const segmentLength = Math.max(64, Math.floor(sampleRate * VM.DURATION));
    if (!signal?.length) throw new Error('Нет сигнала для анализа');

    const scanLimit = meta?.sourceFormat === 'seu_structured' ? 12 : 8;
    const starts = getWindowStartPositions(signal.length, segmentLength, scanLimit);
    const segments = starts.map((start, index) => {
      const slice = signal.slice(start, start + segmentLength);
      const diagnosis = Model.diagnose(slice, sampleRate);
      return {
        index,
        start,
        signal: slice,
        diagnosis,
      };
    });

    if (!segments.length) {
      throw new Error('Не удалось сформировать сегмент для анализа');
    }

    const classMean = {};
    const classPeak = {};
    const classScores = {};
    VM.CLASSES.forEach((cls) => {
      const values = segments.map(({ diagnosis }) => diagnosis.probabilities?.[cls] || 0);
      const mean = values.reduce((sum, value) => sum + value, 0) / segments.length;
      const peak = Math.max(...values);
      classMean[cls] = mean;
      classPeak[cls] = peak;
      classScores[cls] = peak * 0.65 + mean * 0.35;
    });

    const representativeClass = VM.CLASSES.reduce((best, cls) =>
      (classScores[cls] || 0) > (classScores[best] || 0) ? cls : best
    , VM.CLASSES[0]);

    const scoreSum = VM.CLASSES.reduce((sum, cls) => sum + (classScores[cls] || 0), 0) || 1;
    const aggregated = {};
    VM.CLASSES.forEach((cls) => {
      aggregated[cls] = (classScores[cls] || 0) / scoreSum;
    });

    const representative = segments.reduce((best, candidate) => {
      if (!best) return candidate;
      const bestScore = best.diagnosis.probabilities?.[representativeClass] || 0;
      const candidateScore = candidate.diagnosis.probabilities?.[representativeClass] || 0;
      if (candidateScore === bestScore) {
        return (candidate.diagnosis.confidence || 0) > (best.diagnosis.confidence || 0) ? candidate : best;
      }
      return candidateScore > bestScore ? candidate : best;
    }, null);

    return {
      signal: representative.signal,
      diagnosis: {
        ...representative.diagnosis,
        cls: representativeClass,
        confidence: aggregated[representativeClass] || representative.diagnosis.confidence || 0,
        probabilities: aggregated,
      },
      summary: {
        analyzedWindows: segments.length,
        totalWindows: Math.max(1, Math.floor(signal.length / segmentLength)),
        representativeWindow: representative.index + 1,
        representativeStart: representative.start,
        representativeClass,
        representativeMean: classMean[representativeClass] || 0,
        representativePeak: classPeak[representativeClass] || 0,
      },
    };
  }

  // ═══ FILE DIAGNOSIS ═══
  // Supported file formats: .wav, .csv, .tsv, .txt, .mat, .npy, .npz, .dat
  // (update file input accept attribute to: .wav,.csv,.tsv,.txt,.mat,.npy,.npz,.dat)
  async function runFileDiag(file) {
    if(diagLocked)return; diagLocked=true;
    if(currentStop) currentStop();
    clearCurrentDiagnosis();
    currentSourceFile = file;
    activateScenarioCards(null);
    document.querySelectorAll('.fault-btn').forEach(b=>b.classList.remove('active'));
    litPipeline(0); el('diagResult').classList.remove('show');
    if (el('sigDesc')) el('sigDesc').dataset.baseText = '';
    if (el('specDesc')) el('specDesc').dataset.baseText = '';

    try {
      el('sigStatus').textContent='ЗАГРУЗКА...'; el('sigStatus').style.color='#fbbf24';
      litPipeline(1);
      const parsed = await Converter.parseFile(file);
      let signal = parsed.data;
      const fileMeta = parsed.metadata || {};
      const titleHint = detectStructuredClassHint(fileMeta.title, parsed.name);
      currentInputContext = {
        type: 'file',
        label: `${parsed.format.toUpperCase()} · ${parsed.name}`,
        name: parsed.name,
        format: parsed.format,
        channel: parsed.selectedChannel || null,
        sourceTitle: fileMeta.title || null,
        titleHint,
        measurementId: null,
      };
      currentSignalData={data:signal,sampleRate:parsed.sampleRate};

      let chInfo = parsed.channels ? ` | Каналы: ${parsed.channels.length} | Выбран: ${parsed.selectedChannel}` : '';
      let titleInfo = fileMeta.title ? ` | Title: ${fileMeta.title}` : '';
      el('sigStatus').textContent=`\u25cf ${parsed.format.toUpperCase()} ${signal.length} pts`;
      el('sigStatus').style.color='#00e5ff';
      const fileSigBaseText = `${parsed.name} | ${parsed.sampleRate} Hz | ${(signal.length/parsed.sampleRate).toFixed(3)}с${chInfo}${titleInfo}`;
      el('sigDesc').textContent = fileSigBaseText;
      el('sigDesc').dataset.baseText = fileSigBaseText;

      let diagnosisResult = null;
      let segmentSummary = null;
      const max = Math.floor(parsed.sampleRate * VM.DURATION);
      if(signal.length > max && Model.isLoaded()) {
        const segmented = analyzeSegmentedFile(signal, parsed.sampleRate, fileMeta);
        signal = segmented.signal;
        diagnosisResult = segmented.diagnosis;
        segmentSummary = segmented.summary;
      } else if(signal.length > max) {
        signal = signal.slice(0, max);
      }
      if(signal.length < 64) throw new Error('Сигнал слишком короткий');
      currentSignalData={data:signal,sampleRate:parsed.sampleRate};

      if (segmentSummary) {
        const summaryText = `${fileSigBaseText} | Окна: ${segmentSummary.analyzedWindows}/${segmentSummary.totalWindows} | Выбрано: ${segmentSummary.representativeWindow}`;
        el('sigDesc').textContent = summaryText;
        el('sigDesc').dataset.baseText = summaryText;
        currentInputContext.segmentSummary = {
          ...segmentSummary,
          selectedClassHint: titleHint,
        };
      }

      currentStop = Viz.drawSignal('sigCanvas',signal,'#00e5ff',true);
      Viz.addCrosshair(el('sigCanvas'), {type:'signal', data:signal, sampleRate:parsed.sampleRate, color:'#00e5ff'});

      setTimeout(()=>{
        litPipeline(2); el('specStatus').textContent='БПФ...'; el('specStatus').style.color='#fbbf24';
        setTimeout(()=>{
          litPipeline(3);
          const{freqs,spectrum}=FFT.computeSpectrum(signal,parsed.sampleRate);
          Viz.drawSpectrum('specCanvas',freqs,spectrum,'#00e5ff');
          Viz.addCrosshair(el('specCanvas'), {type:'spectrum', data:spectrum, freqs, color:'#00e5ff'});
          el('specStatus').textContent='READY'; el('specStatus').style.color='#00e5ff';
          const fileSpecBaseText = segmentSummary
            ? `Спектр: макс ${Math.round(parsed.sampleRate/2)} Гц | Анализ по ${segmentSummary.analyzedWindows} окнам`
            : `Спектр: макс ${Math.round(parsed.sampleRate/2)} Гц`;
          el('specDesc').textContent = fileSpecBaseText;
          el('specDesc').dataset.baseText = fileSpecBaseText;
          setTimeout(()=>{
            litPipeline(4);
            setTimeout(()=>{
              litPipeline(5);
              if(Model.isLoaded()){
                const r = diagnosisResult || Model.diagnose(signal,parsed.sampleRate);
                showDiagnosis(r.cls,r.probabilities,VM.COLORS[r.cls],signal,r.features);
                // Advanced diagnosis with ONNX models if available
                showAdvancedDiagnosis(signal, r.features, r);
              } else {
                el('diagResult').innerHTML='<div style="color:var(--orange);font-family:var(--mono)">\u26a0 Модель не загружена. Запустите python train.py && python export_model.py</div>';
                el('diagResult').style.border='2px solid var(--orange)';
                el('diagResult').style.background='rgba(251,146,60,0.05)';
                el('diagResult').classList.add('show');
              }
              diagLocked=false;
            },400);
          },350);
        },400);
      },350);
    } catch(err) {
      el('sigStatus').textContent='ОШИБКА'; el('sigStatus').style.color='#f87171';
      el('sigDesc').textContent=err.message;
      if (el('sigDesc')) el('sigDesc').dataset.baseText = err.message;
      diagLocked=false;
    }
  }

  // ═══ DISPLAY ═══
  function showDiagnosis(cls, probs, color, signal, features) {
    const d = el('diagResult');
    d.style.border = `2px solid ${color}`; d.style.background = color + '0a';
    const confidence = probs[cls] || 0;
    const playbook = getPlaybook(cls);
    const sourceLabel = meta ? VM.sourceLabel(meta) : 'Browser inference';
    const engineeringAssessment = buildEngineeringAssessment(signal, cls);
    const engineeringHtml = buildEngineeringEvidenceMarkup(engineeringAssessment);
    const runnerUps = VM.CLASSES
      .filter(c => c !== cls)
      .sort((a, b) => (probs[b] || 0) - (probs[a] || 0))
      .slice(0, 2);

    // --- OOD detection badge ---
    let oodHtml = '';
    if (typeof Model !== 'undefined' && Model.checkOOD) {
      try {
        const oodResult = Model.checkOOD(features || signal);
        const isOOD = oodResult && oodResult.ood;
        oodHtml = `<div style="margin-top:10px;padding:6px 12px;border-radius:6px;font-family:var(--mono);font-size:11px;display:inline-block;${
          isOOD
            ? 'background:rgba(251,146,60,0.15);color:#fb923c;border:1px solid #fb923c'
            : 'background:rgba(52,211,153,0.15);color:#34d399;border:1px solid #34d399'
        }">${isOOD ? '\u26a0 ВНЕ РАСПРЕДЕЛЕНИЯ' : 'В ОБЛАСТИ ОБУЧЕНИЯ \u2713'}${
          oodResult.score != null ? ` (score: ${oodResult.score.toFixed(3)})` : ''
        }</div>`;
      } catch (e) { console.warn('[APP] OOD check failed:', e); }
    }

    // --- SHAP top-3 features ---
    let shapHtml = '';
    if (typeof Model !== 'undefined' && Model.explainPrediction) {
      try {
        const expl = Model.explainPrediction(features || signal, cls);
        if (expl && expl.length) {
          const top3 = expl.slice(0, 3);
          shapHtml = `<div style="margin-top:14px">
            <div class="label" style="margin-bottom:6px">ВКЛАД ПРИЗНАКОВ · TOP-3</div>
            ${top3.map((f, i) => {
              const w = Math.min(Math.abs(f.value) * 100, 100);
              const c = f.value >= 0 ? '#34d399' : '#f87171';
              return `<div style="display:flex;align-items:center;gap:8px;margin:4px 0;font-family:var(--mono);font-size:10px">
                <span style="min-width:90px;color:var(--muted)">${f.name || 'feat_' + i}</span>
                <div style="flex:1;height:6px;background:#1a2234;border-radius:3px;overflow:hidden">
                  <div style="width:${w}%;height:100%;background:${c};border-radius:3px"></div>
                </div>
                <span style="color:${c};min-width:50px;text-align:right">${f.value >= 0 ? '+' : ''}${f.value.toFixed(4)}</span>
              </div>`;
            }).join('')}
          </div>`;
        }
      } catch (e) { console.warn('[APP] SHAP explain failed:', e); }
    }

    // --- RUL estimate gauge ---
    let rulHtml = '';
    if (typeof Model !== 'undefined' && Model.estimateRUL) {
      try {
        const rul = Model.estimateRUL(features || signal);
        if (rul != null) {
          const pct = Math.min(Math.max(rul.percent || (rul.hours / rul.maxHours * 100) || 50, 0), 100);
          const rulColor = pct > 60 ? '#34d399' : pct > 30 ? '#fbbf24' : '#f87171';
          rulHtml = `<div style="margin-top:14px">
            <div class="label" style="margin-bottom:6px">ОЦЕНКА ОСТАТОЧНОГО РЕСУРСА</div>
            <div style="display:flex;align-items:center;gap:10px">
              <div style="flex:1;height:10px;background:#1a2234;border-radius:5px;overflow:hidden">
                <div style="width:${pct}%;height:100%;background:${rulColor};border-radius:5px;transition:width 0.5s"></div>
              </div>
              <span style="font-family:var(--mono);font-size:12px;color:${rulColor};min-width:60px;text-align:right">${
                rul.hours != null ? rul.hours.toFixed(0) + ' ч' : pct.toFixed(0) + '%'
              }</span>
            </div>
          </div>`;
        }
      } catch (e) { console.warn('[APP] RUL estimation failed:', e); }
    }

    // --- Anomaly detection status ---
    let anomalyHtml = '';
    if (typeof Model !== 'undefined' && Model.detectAnomaly) {
      try {
        const anom = Model.detectAnomaly(features || signal);
        if (anom != null) {
          const isAnom = anom.anomaly || anom.score > (anom.threshold || 0.5);
          const anomScore = anom.score != null ? anom.score : (isAnom ? 0.9 : 0.1);
          const anomColor = isAnom ? '#f87171' : '#34d399';
          anomalyHtml = `<div style="margin-top:10px;padding:6px 12px;border-radius:6px;font-family:var(--mono);font-size:11px;display:inline-block;margin-right:8px;${
            isAnom
              ? 'background:rgba(248,113,113,0.15);color:#f87171;border:1px solid #f87171'
              : 'background:rgba(52,211,153,0.15);color:#34d399;border:1px solid #34d399'
          }">${isAnom ? '\u26a0 ANOMALY' : 'NORMAL \u2713'} (${(anomScore * 100).toFixed(1)}%)</div>`;
        }
      } catch (e) { console.warn('[APP] Anomaly detection failed:', e); }
    }

    // --- Multi-model comparison (ONNX) ---
    let multiModelHtml = '';
    if (typeof ModelONNX !== 'undefined' && ModelONNX.diagnose) {
      try {
        const onnxResult = ModelONNX.diagnose(signal || currentSignalData?.data);
        if (onnxResult && onnxResult.cls) {
          const agree = onnxResult.cls === cls;
          multiModelHtml = `<div style="margin-top:14px">
            <div class="label" style="margin-bottom:6px">СРАВНЕНИЕ МОДЕЛЕЙ</div>
            <div style="display:flex;gap:16px;font-family:var(--mono);font-size:11px">
              <div style="padding:8px 14px;border-radius:6px;background:${color}15;border:1px solid ${color}">
                <div style="color:var(--muted);font-size:9px;margin-bottom:4px">RF МОДЕЛЬ</div>
                <div style="color:${color}">${VM.RU[cls]} ${(probs[cls] * 100).toFixed(1)}%</div>
              </div>
              <div style="padding:8px 14px;border-radius:6px;background:${VM.COLORS[onnxResult.cls] || '#a78bfa'}15;border:1px solid ${VM.COLORS[onnxResult.cls] || '#a78bfa'}">
                <div style="color:var(--muted);font-size:9px;margin-bottom:4px">ONNX МОДЕЛЬ</div>
                <div style="color:${VM.COLORS[onnxResult.cls] || '#a78bfa'}">${VM.RU[onnxResult.cls] || onnxResult.cls} ${
                  onnxResult.confidence != null ? (onnxResult.confidence * 100).toFixed(1) + '%' : ''
                }</div>
              </div>
            </div>
            <div style="margin-top:8px;font-family:var(--mono);font-size:10px;color:${agree ? '#34d399' : '#fbbf24'}">
              ${agree ? '\u2713 МОДЕЛИ СОГЛАСНЫ С РЕЗУЛЬТАТОМ' : '\u26a0 ЕСТЬ РАСХОЖДЕНИЕ МОДЕЛЕЙ'}
            </div>
          </div>`;
        }
      } catch (e) { console.warn('[APP] ONNX comparison failed:', e); }
    }

    d.innerHTML = `<div class="diag-shell">
      <div class="diag-main-panel">
        <div class="diag-badge-row">
          <span class="diag-badge diag-badge--${playbook.tone}">${playbook.badge}</span>
          <span class="diag-badge">CONF ${(confidence * 100).toFixed(1)}%</span>
          <span class="diag-badge">${sourceLabel}</span>
        </div>
        <div class="label">РЕЗУЛЬТАТ КЛАССИФИКАЦИИ</div>
        <div class="diag-class" style="color:${color}">${VM.ICONS[cls]} ${VM.RU[cls].toUpperCase()}</div>
        <div class="diag-text">${VM.DESCRIPTIONS[cls].diag}</div>
        <div class="diag-story-grid">
          <div class="diag-story-card">
            <div class="diag-story-label">SEVERITY</div>
            <div class="diag-story-value">${playbook.severity}</div>
            <div class="diag-story-note">${playbook.priority}</div>
          </div>
          <div class="diag-story-card">
            <div class="diag-story-label">RECOMMENDED ACTION</div>
            <div class="diag-story-value">Рекомендуемое действие</div>
            <div class="diag-story-note">${playbook.action}</div>
          </div>
          <div class="diag-story-card">
            <div class="diag-story-label">MODEL EXPLANATION</div>
            <div class="diag-story-value">Ключевой паттерн</div>
            <div class="diag-story-note">${playbook.reason}</div>
          </div>
        </div>
        ${engineeringHtml}
        <div style="margin-top:16px">${oodHtml}${anomalyHtml}</div>
        <div class="diag-action-row">
          <button class="btn btn-primary" type="button" data-save-session="1" onclick="App.saveCurrentSession()">${getSaveActionLabel()}</button>
          <button class="btn" type="button" onclick="App.uploadCurrentMeasurement()">В МОНИТОРИНГ</button>
          <button class="btn" type="button" onclick="App.openSimulatorFromAnalysis()">ПОКАЗАТЬ В 3D</button>
          <button class="btn" type="button" onclick="App.openJournal()">ПРОФИЛЬ</button>
          <a href="simulator.html" class="btn" style="display:inline-flex;align-items:center;text-decoration:none">СИМУЛЯТОР</a>
        </div>
      </div>
      <div class="diag-side-panel">
        <div class="label">РАСПРЕДЕЛЕНИЕ ВЕРОЯТНОСТЕЙ</div>
        ${VM.CLASSES.map(c => {
          const p = (probs[c] || 0) * 100;
          return `<div class="prob-bar-wrap">
            <div class="prob-label" style="color:${VM.COLORS[c]}">${VM.RU[c]}</div>
            <div class="prob-track"><div class="prob-fill" style="width:${p}%;background:${VM.COLORS[c]}"></div></div>
            <div class="prob-val" style="color:${p > 50 ? '#fff' : 'var(--muted)'}">${p.toFixed(1)}%</div>
          </div>`;
        }).join('')}
        <div class="diag-runnerups">
          <div class="diag-runnerups-label">АЛЬТЕРНАТИВНЫЕ КЛАССЫ</div>
          <div class="diag-runnerups-row">
            ${runnerUps.map(c => `<span class="diag-runnerup-pill">
              <span class="dot" style="background:${VM.COLORS[c]}"></span>
              ${VM.RU[c]} ${(probs[c] * 100).toFixed(1)}%
            </span>`).join('')}
          </div>
        </div>
      </div>
    </div>
    ${shapHtml}${rulHtml}${multiModelHtml}`;
    d.classList.add('show');
    renderEngineeringVisuals(signal, cls, color, engineeringAssessment);
    updateCurrentDiagnosis({
      cls,
      confidence,
      probabilities: { ...probs },
      sourceLabel,
      input: { ...currentInputContext },
      playbook,
      signalData: compactSignal(signal || currentSignalData?.data || []),
      sampleRate: currentSignalData?.sampleRate || VM.FS,
    });
  }

  function showDiagFake(cls,color) {
    const p={}; VM.CLASSES.forEach(c=>{p[c]=c===cls?0.94+Math.random()*0.055:Math.random()*0.008;});
    const s=Object.values(p).reduce((a,b)=>a+b); VM.CLASSES.forEach(c=>{p[c]/=s;});
    showDiagnosis(cls,p,color);
  }

  // ═══ ADVANCED DIAGNOSIS ═══
  async function showAdvancedDiagnosis(signal, features, rfResult) {
    const d = el('diagResult');
    if (!d) return;

    let onnxResult = null;
    if (typeof ModelONNX !== 'undefined' && ModelONNX.diagnoseAdvanced) {
      try {
        onnxResult = await ModelONNX.diagnoseAdvanced(signal, features);
      } catch (e) { console.warn('[APP] ONNX advanced diagnosis failed:', e); }
    }

    // Combine RF and ONNX results
    const rfCls = rfResult ? rfResult.cls : null;
    const rfConf = rfResult && rfResult.probabilities ? rfResult.probabilities[rfCls] : 0;

    // --- Build advanced panel ---
    let html = '<div style="margin-top:20px;padding-top:16px;border-top:1px solid rgba(255,255,255,0.06)">';
    html += '<div class="label" style="margin-bottom:12px">ДОПОЛНИТЕЛЬНАЯ АНАЛИТИКА</div>';

    // RUL gauge
    let rulValue = null;
    if (onnxResult && onnxResult.rul != null) {
      rulValue = onnxResult.rul;
    } else if (typeof Model !== 'undefined' && Model.estimateRUL) {
      try { rulValue = Model.estimateRUL(features || signal); } catch (e) {}
    }
    if (rulValue != null) {
      const pct = typeof rulValue === 'object'
        ? (rulValue.percent || (rulValue.hours / (rulValue.maxHours || 1000) * 100) || 50)
        : (rulValue * 100);
      const clampPct = Math.min(Math.max(pct, 0), 100);
      const rColor = clampPct > 60 ? '#34d399' : clampPct > 30 ? '#fbbf24' : '#f87171';
      html += `<div style="margin-bottom:14px">
        <div style="display:flex;justify-content:space-between;font-family:var(--mono);font-size:10px;margin-bottom:4px">
          <span style="color:var(--muted)">ОСТАТОЧНЫЙ РЕСУРС</span>
          <span style="color:${rColor}">${clampPct.toFixed(0)}% осталось</span>
        </div>
        <div style="height:12px;background:#1a2234;border-radius:6px;overflow:hidden;position:relative">
          <div style="width:${clampPct}%;height:100%;background:linear-gradient(90deg,${rColor},${rColor}80);border-radius:6px;transition:width 0.6s"></div>
        </div>
      </div>`;
    }

    // Anomaly meter
    let anomalyScore = null;
    if (onnxResult && onnxResult.anomalyScore != null) {
      anomalyScore = onnxResult.anomalyScore;
    } else if (typeof Model !== 'undefined' && Model.detectAnomaly) {
      try {
        const a = Model.detectAnomaly(features || signal);
        anomalyScore = a ? (a.score != null ? a.score : (a.anomaly ? 0.85 : 0.1)) : null;
      } catch (e) {}
    }
    if (anomalyScore != null) {
      const aClamp = Math.min(Math.max(anomalyScore, 0), 1);
      const aColor = aClamp > 0.7 ? '#f87171' : aClamp > 0.4 ? '#fbbf24' : '#34d399';
      html += `<div style="margin-bottom:14px">
        <div style="display:flex;justify-content:space-between;font-family:var(--mono);font-size:10px;margin-bottom:4px">
          <span style="color:var(--muted)">ОЦЕНКА АНОМАЛЬНОСТИ</span>
          <span style="color:${aColor}">${(aClamp * 100).toFixed(1)}%</span>
        </div>
        <div style="height:8px;background:#1a2234;border-radius:4px;overflow:hidden">
          <div style="width:${aClamp * 100}%;height:100%;background:${aColor};border-radius:4px;transition:width 0.6s"></div>
        </div>
      </div>`;
    }

    // Multi-model agreement
    if (onnxResult && rfResult) {
      const models = [{ name: 'Random Forest', cls: rfCls, conf: rfConf }];
      if (onnxResult.cnn) models.push({ name: 'CNN', cls: onnxResult.cnn.cls, conf: onnxResult.cnn.confidence || 0 });
      if (onnxResult.gru) models.push({ name: 'GRU', cls: onnxResult.gru.cls, conf: onnxResult.gru.confidence || 0 });
      if (onnxResult.autoencoder) models.push({ name: 'Autoencoder', cls: onnxResult.autoencoder.cls, conf: onnxResult.autoencoder.confidence || 0 });
      if (onnxResult.cls) models.push({ name: 'ONNX Ensemble', cls: onnxResult.cls, conf: onnxResult.confidence || 0 });

      const uniqueVotes = [...new Set(models.map(m => m.cls))];
      const allAgree = uniqueVotes.length === 1;
      const majorityVote = uniqueVotes.reduce((best, c) => {
        const count = models.filter(m => m.cls === c).length;
        return count > best.count ? { cls: c, count } : best;
      }, { cls: null, count: 0 });

      html += `<div style="margin-bottom:14px">
        <div class="label" style="margin-bottom:8px">СОГЛАСИЕ МОДЕЛЕЙ</div>
        <div style="display:flex;flex-wrap:wrap;gap:8px">
          ${models.map(m => {
            const mc = VM.COLORS[m.cls] || '#a78bfa';
            return `<div style="padding:6px 12px;border-radius:6px;background:${mc}12;border:1px solid ${mc}40;font-family:var(--mono);font-size:10px">
              <div style="color:var(--muted);font-size:8px;margin-bottom:2px">${m.name}</div>
              <div style="color:${mc}">${VM.RU[m.cls] || m.cls} ${(m.conf * 100).toFixed(1)}%</div>
            </div>`;
          }).join('')}
        </div>
        <div style="margin-top:8px;font-family:var(--mono);font-size:10px;color:${allAgree ? '#34d399' : '#fbbf24'}">
          ${allAgree
            ? '\u2713 ПОЛНОЕ СОГЛАСИЕ МОДЕЛЕЙ'
            : '\u26a0 ЧАСТИЧНОЕ СОГЛАСИЕ · большинство за ' + (VM.RU[majorityVote.cls] || majorityVote.cls) + ' (' + majorityVote.count + '/' + models.length + ')'
          }
        </div>
      </div>`;
    }

    html += '</div>';
    d.innerHTML += html;
  }

  // ═══ SENSOR UI ═══
  let sensorStream = null, sensorConnected = false;

  function initSensorUI() {
    if (document.body?.dataset?.mode === 'defense') return;
    const zone = el('uploadZone');
    if (!zone || !zone.parentNode) return;
    // Don't add twice
    if (el('sensorPanel')) return;

    const panel = document.createElement('div');
    panel.id = 'sensorPanel';
    panel.style.cssText = 'margin-top:20px;padding:16px;border:1px solid rgba(255,255,255,0.08);border-radius:10px;background:rgba(0,0,0,0.2)';
    panel.innerHTML = `
      <div class="label" style="margin-bottom:10px">SENSOR CONNECTION</div>
      <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
        <button class="btn" id="btnSensorSerial" onclick="App.connectSensor('serial')" style="font-size:11px">\ud83d\udd0c Serial</button>
        <button class="btn" id="btnSensorBLE" onclick="App.connectSensor('ble')" style="font-size:11px">\ud83d\udce1 BLE</button>
        <button class="btn btn-primary" id="btnSensorRecord" onclick="App.recordSensor()" style="font-size:11px;display:none">\u23fa Record & Diagnose</button>
        <span id="sensorStatus" style="font-family:var(--mono);font-size:11px;color:var(--muted)">\u25cb Disconnected</span>
      </div>
    `;
    zone.parentNode.insertBefore(panel, zone.nextSibling);
  }

  async function connectSensorUI(type) {
    const statusEl = el('sensorStatus');
    const recordBtn = el('btnSensorRecord');

    if (typeof Sensor === 'undefined') {
      if (statusEl) statusEl.innerHTML = '<span style="color:#f87171">\u2717 Sensor module not loaded</span>';
      return;
    }

    if (statusEl) statusEl.innerHTML = '<span style="color:#fbbf24">\u25cb Connecting...</span>';

    try {
      if (type === 'serial' && Sensor.connectSerial) {
        sensorStream = await Sensor.connectSerial();
      } else if (type === 'ble' && Sensor.connectBLE) {
        sensorStream = await Sensor.connectBLE();
      } else {
        throw new Error('Connection type "' + type + '" not supported');
      }
      sensorConnected = true;
      if (statusEl) statusEl.innerHTML = '<span style="color:#34d399">\u25cf Connected (' + type.toUpperCase() + ')</span>';
      if (recordBtn) recordBtn.style.display = 'inline-flex';
      console.log('[APP] Sensor connected via', type);
    } catch (e) {
      sensorConnected = false;
      if (statusEl) statusEl.innerHTML = `<span style="color:#f87171">\u2717 ${e.message || 'Connection failed'}</span>`;
      console.warn('[APP] Sensor connection failed:', e);
    }
  }

  async function startSensorRecording() {
    if (!sensorConnected || typeof Sensor === 'undefined') return;
    const statusEl = el('sensorStatus');
    if (statusEl) statusEl.innerHTML = '<span style="color:#fbbf24">\u25cf Recording...</span>';
    clearCurrentDiagnosis();
    currentSourceFile = null;

    try {
      const duration = 0.5; // seconds
      const recording = await Sensor.record(sensorStream, { duration });
      if (!recording || !recording.data || recording.data.length < 64) {
        throw new Error('Recording too short (' + (recording ? recording.data.length : 0) + ' samples)');
      }
      if (statusEl) statusEl.innerHTML = '<span style="color:#34d399">\u25cf Connected</span>';

      currentInputContext = {
        type: 'sensor',
        label: 'Live sensor capture',
        measurementId: null,
      };
      currentSignalData = { data: recording.data, sampleRate: recording.sampleRate || VM.FS };
      const signal = recording.data;
      const sr = recording.sampleRate || VM.FS;

      // Draw signal
      if (currentStop) currentStop();
      currentStop = Viz.drawSignal('sigCanvas', signal, '#a78bfa', true);
      el('sigStatus').textContent = '\u25cf SENSOR'; el('sigStatus').style.color = '#a78bfa';
      const sensorSigBaseText = `Sensor recording | ${sr} Hz | ${signal.length} pts | ${(signal.length / sr).toFixed(3)}s`;
      el('sigDesc').textContent = sensorSigBaseText;
      el('sigDesc').dataset.baseText = sensorSigBaseText;

      // Spectrum
      const { freqs, spectrum } = FFT.computeSpectrum(signal, sr);
      Viz.drawSpectrum('specCanvas', freqs, spectrum, '#a78bfa');
      el('specStatus').textContent = 'READY'; el('specStatus').style.color = '#a78bfa';
      const sensorSpecBaseText = `FFT | Nyquist ${Math.round(sr / 2)} Hz`;
      el('specDesc').textContent = sensorSpecBaseText;
      el('specDesc').dataset.baseText = sensorSpecBaseText;

      // Diagnose
      litPipeline(5);
      if (Model.isLoaded()) {
        const r = Model.diagnose(signal, sr);
        showDiagnosis(r.cls, r.probabilities, VM.COLORS[r.cls], signal, r.features);
        showAdvancedDiagnosis(signal, r.features, r);
      }
    } catch (e) {
      if (statusEl) statusEl.innerHTML = `<span style="color:#f87171">\u2717 ${e.message}</span>`;
      console.warn('[APP] Sensor recording failed:', e);
    }
  }

  // ═══ UPLOAD ZONES ═══
  function setupUpload() {
    setupDrop('uploadZone','uploadFileInput',f=>runFileDiag(f));
    setupDrop('convertDropZone','convertFileInput',f=>handleConvert(f));
  }

  function setupDrop(zoneId, inputId, handler) {
    const z=el(zoneId), inp=el(inputId);
    if(!z||!inp) return;
    z.addEventListener('click',()=>inp.click());
    z.addEventListener('dragover',e=>{e.preventDefault();z.classList.add('dragover');});
    z.addEventListener('dragleave',()=>z.classList.remove('dragover'));
    z.addEventListener('drop',e=>{e.preventDefault();z.classList.remove('dragover');if(e.dataTransfer.files.length)handler(e.dataTransfer.files[0]);});
    inp.addEventListener('change',()=>{if(inp.files.length)handler(inp.files[0]);});
  }

  // ═══ CONVERTER ═══
  async function handleConvert(file) {
    const rEl=el('convertResult'),info=el('convertInfo'),acts=el('convertActions');
    try {
      const p=await Converter.parseFile(file);
      currentSignalData={data:p.data,sampleRate:p.sampleRate};
      const chHtml=p.channels?`<div style="margin:12px 0"><span class="label" style="margin-right:8px">КАНАЛ:</span>${p.channels.map(ch=>
        `<button class="fault-btn ${ch.name===p.selectedChannel?'active':''}" style="padding:6px 14px;font-size:10px" data-ch="${ch.name}" onclick="App._switchCh&&App._switchCh('${ch.name}')">${ch.name}</button>`
      ).join('')}</div>`:'';

      info.innerHTML=`<div style="margin-bottom:8px"><span style="color:var(--green);font-family:var(--mono)">✓ ${file.name}</span>
        <span style="color:var(--muted);margin-left:12px;font-size:12px">${p.format.toUpperCase()} | ${p.sampleRate}Hz | ${p.data.length} pts | ${(p.data.length/p.sampleRate).toFixed(3)}с${p.channels?' | '+p.channels.length+'ch':''}</span></div>${chHtml}`;

      const cv=el('convertPreview');
      if(cv) Viz.drawSignal(cv,p.data.length>2000?p.data.slice(0,2000):p.data,'#00e5ff',false);

      acts.innerHTML='';
      if(p.format==='wav'){
        acts.innerHTML+=`<button class="btn" onclick="Converter.download(Converter.createCSV(App._csData.data,App._csData.sr),'${file.name.replace(/\.wav$/i,'.csv')}')">📄 CSV</button>`;
      } else {
        acts.innerHTML+=`<button class="btn" onclick="Converter.download(Converter.createWAV(App._csData.data,App._csData.sr),'${file.name.replace(/\.(csv|tsv|txt)$/i,'.wav')}')">🔊 WAV</button>`;
      }
      acts.innerHTML+=`<button class="btn btn-primary" onclick="goPage('diag');setTimeout(()=>App.fileDiag(App._csFile),300)">⚡ ДИАГНОСТИКА</button>`;
      App._csData={data:p.data,sr:p.sampleRate}; App._csFile=file;

      if(p.channels){
        App._switchCh=async(ch)=>{
          const rp=await Converter.parseFile(file,ch);
          App._csData={data:rp.data,sr:rp.sampleRate};
          if(cv) Viz.drawSignal(cv,rp.data.length>2000?rp.data.slice(0,2000):rp.data,'#00e5ff',false);
          document.querySelectorAll('[data-ch]').forEach(b=>b.classList.toggle('active',b.dataset.ch===ch));
        };
      }
      rEl.classList.add('show');
    } catch(err) {
      info.innerHTML=`<span style="color:var(--red);font-family:var(--mono)">✗ ${err.message}</span>`;
      acts.innerHTML=''; rEl.classList.add('show');
    }
  }

  // ═══ BUILD UI ═══
  function buildFaultBtns() {
    const c=el('faultBtns'); if(!c)return;
    c.innerHTML='';
    VM.CLASSES.forEach(cls=>{
      const playbook = getPlaybook(cls);
      const b=document.createElement('button');
      b.className='fault-btn'; b.dataset.cls=cls;
      b.innerHTML=`<span class="fault-btn-top">
        <span class="dot" style="background:${VM.COLORS[cls]}"></span>
        <span class="fault-btn-icon" style="color:${VM.COLORS[cls]}">${VM.ICONS[cls]}</span>
        <span class="fault-btn-state fault-btn-state--${playbook.tone}">${playbook.badge}</span>
      </span>
      <span class="fault-btn-title">${VM.RU[cls]}</span>
      <span class="fault-btn-caption">${playbook.short}</span>`;
      b.onclick=()=>runDemo(cls); c.appendChild(b);
    });
  }

  function buildModel() {
    // Try to use meta.json data, fallback to placeholder
    if(!meta) { buildModelPlaceholder(); return; }
    syncHeroMeta(meta);

    // Confusion matrix
    const cm=meta.confusion_matrix, cls=meta.classes;
    const t=el('cmTable'); if(t) {
      let h='<thead><tr><th style="text-align:left;font-size:8px">ФАКТ↓ ПРЕД→</th>';
      cls.forEach(c=>{h+=`<th style="color:${VM.COLORS[c]||'var(--text)'};min-width:36px">${(VM.RU[c]||c).substring(0,5)}</th>`;});
      h+='</tr></thead><tbody>';
      cls.forEach((tc,i)=>{
        h+=`<tr><td style="text-align:left;color:${VM.COLORS[tc]||'var(--text)'};font-weight:600;padding-right:10px">${VM.RU[tc]||tc}</td>`;
        cls.forEach((pc,j)=>{
          const v=cm[i][j],d=i===j;
          h+=`<td style="background:${d?(VM.COLORS[tc]||'#00e5ff')+'20':v>0?'#fb923c25':'transparent'};color:${d?'#fff':v>0?'#fb923c':'#1a2234'};font-weight:${d?700:400}">${v}</td>`;
        }); h+='</tr>';
      }); h+='</tbody>'; t.innerHTML=h;
    }

    // Class metrics
    const mc=el('clsMetrics'); if(mc&&meta.class_metrics) {
      mc.innerHTML='';
      cls.forEach(c=>{
        const m=meta.class_metrics[c]||{precision:0,recall:0,f1:0};
        mc.innerHTML+=`<div class="cls-row">
          <div><span class="cls-dot" style="background:${VM.COLORS[c]||'#ccc'}"></span><span class="mono" style="font-size:11px;color:${VM.COLORS[c]||'#ccc'}">${VM.RU[c]||c}</span></div>
          <div><div class="cls-val">${(m.precision*100).toFixed(1)}%</div><div class="cls-sublabel">PRECISION</div></div>
          <div><div class="cls-val">${(m.recall*100).toFixed(1)}%</div><div class="cls-sublabel">RECALL</div></div>
          <div><div class="cls-val" style="color:${m.f1>=0.99?'var(--green)':'var(--yellow)'}">${(m.f1*100).toFixed(1)}%</div><div class="cls-sublabel">F1</div></div>
        </div>`;
      });
    }

    // Feature importances
    const fb=el('fiBars'); if(fb&&meta.feature_importances) {
      fb.innerHTML='';
      const fi=meta.feature_importances.slice(0,15), maxV=fi[0].importance;
      const cols=['#00e5ff','#00e5ff','#00e5ff','#34d399','#34d399','#34d399','#fbbf24','#fbbf24','#fbbf24','#fbbf24','#a78bfa','#a78bfa','#4a5568','#4a5568','#4a5568'];
      fi.forEach((f,i)=>{
        fb.innerHTML+=`<div class="fi-bar-row"><div class="fi-name">${f.name}</div>
          <div class="fi-track"><div class="fi-fill" style="width:${f.importance/maxV*100}%;background:${cols[i]||'#4a5568'}"></div></div>
          <div class="fi-val">${(f.importance*100).toFixed(2)}%</div></div>`;
      });
    }

    // Update metrics cards with count-up animation
    const acc=el('metAcc'),f1e=el('metF1'),ncl=el('metClasses'),nfe=el('metFeats'),nsa=el('metSamples'),src=el('metSource');
    function countUp(el, target, suffix, decimals, duration) {
      if(!el) return;
      const start = 0, d = duration || 1200, t0 = performance.now();
      function step(now) {
        const p = Math.min((now - t0) / d, 1);
        const ease = 1 - Math.pow(1 - p, 3); // easeOutCubic
        const v = start + (target - start) * ease;
        el.textContent = v.toFixed(decimals || 0) + (suffix || '');
        if (p < 1) requestAnimationFrame(step);
      }
      requestAnimationFrame(step);
    }
    // Use IntersectionObserver to trigger when visible
    const metricsRow = document.querySelector('.metrics-row');
    if (metricsRow && !metricsRow.dataset.animated) {
      const obs = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            metricsRow.dataset.animated = '1';
            countUp(acc, meta.accuracy*100, '%', 1);
            countUp(f1e, meta.f1, '', 3);
            countUp(ncl, meta.classes.length, '', 0, 800);
            countUp(nfe, meta.n_features||meta.n_features_selected||meta.feature_names.length, '', 0, 800);
            countUp(nsa, meta.train_size+meta.test_size, '', 0, 1000);
            if(src) src.textContent=VM.sourceLabel(meta);
            obs.unobserve(metricsRow);
          }
        });
      }, { threshold: 0.3 });
      obs.observe(metricsRow);
    } else {
      if(acc) acc.textContent=(meta.accuracy*100).toFixed(1)+'%';
      if(f1e) f1e.textContent=meta.f1.toFixed(3);
      if(ncl) ncl.textContent=meta.classes.length;
      if(nfe) nfe.textContent=meta.n_features||meta.n_features_selected||meta.feature_names.length;
      if(nsa) nsa.textContent=meta.train_size+meta.test_size;
      if(src) src.textContent=VM.sourceLabel(meta);
    }

    // Model params
    const mp=el('modelParams'); if(mp&&meta.model_params) {
      const p=meta.model_params.rf_tuned||meta.model_params;
      const nf=meta.n_features||meta.n_features_selected||'?';
      let html=`<b>Алгоритм:</b> ${meta.best_model||'Random Forest'}<br><b>Деревья:</b> ${p.n_estimators}<br>
        <b>Max depth:</b> ${p.max_depth}<br><b>Признаков:</b> ${nf}<br>`;
      if(meta.cv_mean!=null) html+=`<b>CV Score:</b> <span style="color:var(--green)">${(meta.cv_mean*100).toFixed(1)}% ± ${(meta.cv_std*100).toFixed(1)}</span><br>`;
      html+=`<b>Train/Test:</b> ${meta.train_size}/${meta.test_size}<br>
        <b>Источник:</b> ${VM.sourceLabel(meta)}<br>
        <b>fs:</b> ${meta.config.fs} Hz | <b>GMF:</b> ${meta.config.gmf} Hz`;
      if(meta.pipeline) html+=`<br><b>Pipeline:</b> ${meta.pipeline}`;
      mp.innerHTML=html;
    }
  }

  function buildModelPlaceholder() {
    const t=el('cmTable'); if(t) t.innerHTML='<tr><td style="color:var(--muted);padding:40px">Обучите модель: python train.py → python export_model.py</td></tr>';
    const mc=el('clsMetrics'); if(mc) mc.innerHTML='<div style="color:var(--muted);padding:20px">Метрики появятся после обучения</div>';
    const fb=el('fiBars'); if(fb) fb.innerHTML='<div style="color:var(--muted);padding:20px">Feature importances появятся после обучения</div>';
  }

  function el(id) { return document.getElementById(id); }

  // ═══ INIT ═══
  async function init() {
    document.querySelectorAll('.nav-btn').forEach(b => {
      if (b.dataset.page) b.addEventListener('click', () => goPage(b.dataset.page));
    });
    setupCabinetUI();
    setupUpload();
    Viz.heroOscilloscope('heroOsc');

    // Load meta.json
    try {
      const r=await fetch(`model/meta.json?v=${ASSET_VERSION}`, { cache: 'no-store' });
      if(r.ok) {
        meta=await r.json();
        VM.syncMeta(meta);
        console.log('[APP] meta.json loaded:',meta.source,meta.dataset_scope,meta.accuracy);
      }
    } catch(e) { console.log('[APP] No meta.json'); }

    buildFaultBtns();
    buildModel();
    setupScenarioLinks();
    initRevealSystem();
    if (typeof DemoCases !== 'undefined') {
      await DemoCases.load(`model/demo_cases.json?v=${ASSET_VERSION}`);
    }

    // Load RF model
    const ok=await Model.load(`model/rf_model.json?v=${ASSET_VERSION}`);
    console.log(ok?'[APP] RF Model ready':'[APP] RF Model not found \u2014 demo mode');

    try {
      await apiRequest('/health');
      apiReady = true;
      await loadAuthState();
      if (authState?.id) {
        await loadHistory();
      } else {
        renderAuthSummary();
        syncWorkspaceSelection();
        renderWorkspace();
      }
    } catch (e) {
      apiReady = false;
      authState = normalizeAuth(null);
      sessionHistory = [];
      assetRegistry = [];
      measurementRegistry = [];
      reportRegistry = [];
      dashboardSummary = null;
      renderAuthSummary();
      syncWorkspaceSelection();
      renderWorkspace();
      console.warn('[APP] Backend API not available:', e.message || e);
    }
    updateHeaderProfile();
    renderCaptureSummary();

    // Load ONNX models if available
    if (typeof ModelONNX !== 'undefined' && ModelONNX.loadAll) {
      try {
        const onnxOk = await ModelONNX.loadAll();
        console.log(onnxOk ? '[APP] ONNX models loaded' : '[APP] ONNX models not available');
      } catch (e) { console.log('[APP] ONNX load skipped:', e.message || e); }
    }

    // Initialize sensor UI
    initSensorUI();

    // Log available models
    const availModels = ['RF'];
    if (typeof ModelONNX !== 'undefined') availModels.push('ONNX');
    if (typeof Model !== 'undefined' && Model.checkOOD) availModels.push('OOD');
    if (typeof Model !== 'undefined' && Model.explainPrediction) availModels.push('SHAP');
    if (typeof Model !== 'undefined' && Model.estimateRUL) availModels.push('RUL');
    if (typeof Model !== 'undefined' && Model.detectAnomaly) availModels.push('Anomaly');
    if (typeof Sensor !== 'undefined') availModels.push('Sensor');
    console.log('[APP] Available modules:', availModels.join(', '));

    window.goPage=goPage;
    window.goHomeSection=goHomeSection;
    window.goPageSection=goPageSection;
  }

  return {
    init,
    goPage,
    goHomeSection,
    goPageSection,
    openJournal,
    openAssetPage,
    openSimulatorFromAnalysis,
    uploadCurrentMeasurement,
    saveCurrentSession,
    fileDiag: runFileDiag,
    runScenario,
    connectSensor: connectSensorUI,
    recordSensor: startSensorRecording,
    showAdvancedDiagnosis
  };
})();

document.addEventListener('DOMContentLoaded', App.init);
