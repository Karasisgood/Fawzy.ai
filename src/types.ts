export type AppMode = 'chat' | 'code';

export type ThemePreference = 'light' | 'dark' | 'system';

export type ResponseStyle = 'balanced' | 'concise' | 'detailed';

export interface UserSettings {
  theme: ThemePreference;
  responseStyle: ResponseStyle;
  customInstructions: string;
  autoPreviewHtml: boolean;
}

export interface UserAccount {
  uid: string;
  username: string;
  email: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  createdAt: number;
  isError?: boolean;
}

export interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  updatedAt: number;
}
