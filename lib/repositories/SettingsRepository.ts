import { DocumentData, Timestamp } from "firebase/firestore";
import { BaseRepository } from "./BaseRepository";
import { Collections } from "@/lib/firebase";
import { Settings, ISettings } from "@/lib/models";

export class SettingsRepository extends BaseRepository<ISettings> {
  private static instance: SettingsRepository;

  private constructor() {
    super(Collections.SETTINGS);
  }

  static getInstance(): SettingsRepository {
    if (!SettingsRepository.instance) {
      SettingsRepository.instance = new SettingsRepository();
    }
    return SettingsRepository.instance;
  }

  protected fromFirestore(id: string, data: DocumentData): ISettings {
    return Settings.fromFirestore({ id, ...data } as ISettings);
  }

  async getGlobalSettings(): Promise<ISettings | null> {
    return this.findById(Settings.DOCUMENT_ID);
  }

  async getOrCreateGlobalSettings(userId: string): Promise<ISettings> {
    const existing = await this.getGlobalSettings();
    if (existing) {
      return existing;
    }

    const defaultSettings = Settings.createDefault(userId);
    return this.createWithId(Settings.DOCUMENT_ID, defaultSettings);
  }

  async updateGlobalSettings(
    data: Partial<ISettings>,
    updatedBy: string
  ): Promise<void> {
    await this.update(Settings.DOCUMENT_ID, {
      ...data,
      updatedAt: Timestamp.now(),
      updatedBy,
    });
  }
}

export const settingsRepository = SettingsRepository.getInstance();
