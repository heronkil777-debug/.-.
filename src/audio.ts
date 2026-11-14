type Sound = 'click' | 'success' | 'error' | 'pad';

/** Original, gently synthesized soundscape. No autoplay, audio files, or external services. */
export class Soundscape {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private enabled = false;

  async setEnabled(enabled: boolean): Promise<boolean> {
    if (!enabled) {
      this.enabled = false;
      if (this.context?.state === 'running') await this.context.suspend();
      return false;
    }
    try {
      if (!this.context || this.context.state === 'closed') {
        const AudioCtor =
          window.AudioContext ??
          (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!AudioCtor) return false;
        this.context = new AudioCtor();
        this.master = this.context.createGain();
        this.master.gain.value = 0.2;
        this.master.connect(this.context.destination);
        this.createAmbience();
      }
      await this.context.resume();
      this.enabled = this.context.state === 'running';
      return this.enabled;
    } catch {
      this.enabled = false;
      return false;
    }
  }

  private createAmbience() {
    const ctx = this.context!;
    for (const [frequency, volume] of [
      [55, 0.065],
      [82.41, 0.025],
      [110.15, 0.014],
    ]) {
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.value = frequency;
      gain.gain.value = volume;
      oscillator.connect(gain).connect(this.master!);
      oscillator.start();
    }
    const buffer = ctx.createBuffer(1, ctx.sampleRate * 3, ctx.sampleRate);
    const samples = buffer.getChannelData(0);
    let previous = 0;
    for (let i = 0; i < samples.length; i++) {
      previous = (previous + (Math.random() * 2 - 1) * 0.025) / 1.025;
      samples[i] = previous * 2;
    }
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 320;
    const gain = ctx.createGain();
    gain.gain.value = 0.07;
    source.connect(filter).connect(gain).connect(this.master!);
    source.start();
  }

  play(sound: Sound, pad = 0) {
    if (!this.enabled || !this.context || this.context.state !== 'running') return;
    const ctx = this.context;
    const notes =
      sound === 'success'
        ? [440, 554.37, 659.25]
        : sound === 'error'
          ? [130, 110]
          : sound === 'pad'
            ? [[261.63, 329.63, 392, 523.25][pad % 4]]
            : [720];
    notes.forEach((frequency, index) => {
      const start = ctx.currentTime + index * 0.11;
      const duration = sound === 'success' ? 0.65 : sound === 'pad' ? 0.34 : 0.12;
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(sound === 'click' ? 0.09 : 0.22, start + 0.014);
      gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
      oscillator.connect(gain).connect(this.master!);
      oscillator.start(start);
      oscillator.stop(start + duration + 0.03);
      oscillator.onended = () => {
        oscillator.disconnect();
        gain.disconnect();
      };
    });
  }

  dispose() {
    this.enabled = false;
    void this.context?.close();
    this.context = null;
    this.master = null;
  }
}
