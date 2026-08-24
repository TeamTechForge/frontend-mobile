import { createAudioPlayer, setAudioModeAsync, AudioPlayer } from "expo-audio";
import { Asset } from "expo-asset";

class CallAudioService {
  private incomingRingtone: AudioPlayer | null = null;
  private outgoingRingback: AudioPlayer | null = null;

  private activeMode: "idle" | "incoming" | "outgoing" = "idle";

  /**
   * Initializes the audio mode to allow playback in the background and respect silent mode.
   */
  private async initAudioMode() {
    try {
      await setAudioModeAsync({
        allowsRecording: false,
        playsInSilentMode: true,
        shouldPlayInBackground: true,
        interruptionMode: "duckOthers",
        shouldRouteThroughEarpiece: false,
      });
    } catch (error) {
      console.error("[CallAudioService] Failed to init audio mode", error);
    }
  }

  /**
   * Play the incoming ringtone
   */
  public async playIncoming() {
    try {
      this.activeMode = "incoming";
      await this.initAudioMode();
      await this.stopAllInternal(); // Internal stop that doesn't change activeMode

      const asset = Asset.fromModule(require("../assets/sounds/ringtone.wav"));
      await asset.downloadAsync();

      if (this.activeMode !== "incoming") return;

      this.incomingRingtone = createAudioPlayer(asset.localUri || asset.uri);
      this.incomingRingtone.loop = true;
      this.incomingRingtone.play();
    } catch (error) {
      console.error("[CallAudioService] Failed to play incoming ringtone", error);
    }
  }

  /**
   * Play the outgoing ringback tone
   */
  public async playOutgoing() {
    try {
      this.activeMode = "outgoing";
      await this.initAudioMode();
      await this.stopAllInternal(); // Internal stop that doesn't change activeMode

      const asset = Asset.fromModule(require("../assets/sounds/ringback.wav"));
      await asset.downloadAsync();

      if (this.activeMode !== "outgoing") return;

      this.outgoingRingback = createAudioPlayer(asset.localUri || asset.uri);
      this.outgoingRingback.loop = true;
      this.outgoingRingback.play();
    } catch (error) {
      console.error("[CallAudioService] Failed to play outgoing ringback", error);
    }
  }

  /**
   * Stop the incoming ringtone
   */
  public async stopIncoming() {
    try {
      if (this.incomingRingtone) {
        this.incomingRingtone.pause();
        this.incomingRingtone.remove();
        this.incomingRingtone = null;
      }
    } catch (error) {
      console.error("[CallAudioService] Failed to stop incoming ringtone", error);
    }
  }

  /**
   * Stop the outgoing ringback tone
   */
  public async stopOutgoing() {
    try {
      if (this.outgoingRingback) {
        this.outgoingRingback.pause();
        this.outgoingRingback.remove();
        this.outgoingRingback = null;
      }
    } catch (error) {
      console.error("[CallAudioService] Failed to stop outgoing ringback", error);
    }
  }

  /**
   * Stop all active audio playback
   */
  public async stopAll() {
    this.activeMode = "idle";
    await this.stopAllInternal();
  }

  private async stopAllInternal() {
    await this.stopIncoming();
    await this.stopOutgoing();
  }
}

export default new CallAudioService();
