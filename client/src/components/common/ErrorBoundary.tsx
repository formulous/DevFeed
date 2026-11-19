import { Component, type ErrorInfo, type ReactNode } from 'react';

const RELOAD_FLAG = 'devfeed:chunk-reload';

export function isChunkLoadError(error: unknown) {
  if (!(error instanceof Error)) return false;
  return (
    error.name === 'ChunkLoadError' ||
    /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module/i.test(
      error.message,
    )
  );
}

function readFlag() {
  try {
    return sessionStorage.getItem(RELOAD_FLAG) === '1';
  } catch {
    return true;
  }
}

function writeFlag(on: boolean) {
  try {
    if (on) sessionStorage.setItem(RELOAD_FLAG, '1');
    else sessionStorage.removeItem(RELOAD_FLAG);
  } catch {
    /* storage unavailable */
  }
}

interface Props {
  resetKey: string;
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(error, info.componentStack);
    if (isChunkLoadError(error) && !readFlag()) {
      writeFlag(true);
      window.location.reload();
    }
  }

  componentDidUpdate(prev: Props) {
    if (prev.resetKey !== this.props.resetKey && this.state.error) this.setState({ error: null });
    if (!this.state.error) writeFlag(false);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    const chunk = isChunkLoadError(error);
    return (
      <div role="alert" className="mx-auto my-16 max-w-md rounded-[var(--radius-lg)] border border-line bg-surface p-6 text-center">
        <p className="text-base font-semibold">{chunk ? '새 버전이 배포됐음' : '화면을 그리다 문제가 생겼음'}</p>
        <p className="mt-2 text-sm text-fg-secondary">
          {chunk ? '새로고침하면 최신 화면을 불러옴' : '새로고침해도 계속되면 잠시 뒤 다시 시도하셈'}
        </p>
        <div className="mt-5 flex justify-center gap-2">
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white"
          >
            새로고침
          </button>
          <a href={import.meta.env.BASE_URL} className="rounded-md border border-line px-4 py-2 text-sm">
            홈으로
          </a>
        </div>
      </div>
    );
  }
}
