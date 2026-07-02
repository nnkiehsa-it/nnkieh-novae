interface BeforeInstallPromptUserChoice {
  outcome: 'accepted' | 'dismissed';
  platform: string;
}

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<BeforeInstallPromptUserChoice>;
  prompt(): Promise<void>;
}

declare const __APP_VERSION__: string;
