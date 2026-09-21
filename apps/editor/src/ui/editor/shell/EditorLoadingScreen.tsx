interface EditorLoadingScreenProps {
  message?: string;
}

/**
 * Presentational screen displayed while an external presentation deck is being fetched.
 */
export function EditorLoadingScreen({
  message = 'Loading presentation...',
}: EditorLoadingScreenProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        display: 'flex',
        height: '100vh',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#0a0f12',
        color: '#fff',
        fontFamily: 'sans-serif',
      }}
    >
      <p>{message}</p>
    </div>
  );
}
