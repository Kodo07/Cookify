export function playTimerDoneTone(): void {
  if (typeof window === "undefined") {
    return;
  }

  const AudioContextCtor =
    window.AudioContext ||
    ((window as Window & { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext as typeof AudioContext | undefined);

  if (!AudioContextCtor) {
    return;
  }

  try {
    const context = new AudioContextCtor();
    const oscillator = context.createOscillator();
    const gain = context.createGain();

    oscillator.type = "triangle";
    oscillator.frequency.setValueAtTime(880, context.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(
      660,
      context.currentTime + 0.35
    );

    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.12, context.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.4);

    oscillator.connect(gain);
    gain.connect(context.destination);

    oscillator.start();
    oscillator.stop(context.currentTime + 0.45);

    void context.close().catch(() => undefined);
  } catch {
    // Ignore sound failures.
  }
}
