import { ISettings, ISettingsUpdate } from "@/lib/models";
import { settingsRepository } from "@/lib/repositories";

export class SettingsService {
  private static instance: SettingsService;

  private constructor() {}

  static getInstance(): SettingsService {
    if (!SettingsService.instance) {
      SettingsService.instance = new SettingsService();
    }
    return SettingsService.instance;
  }

  async getSettings(userId: string): Promise<ISettings> {
    return settingsRepository.getOrCreateGlobalSettings(userId);
  }

  async updateSettings(
    data: ISettingsUpdate,
    updatedBy: string
  ): Promise<ISettings | null> {
    await settingsRepository.updateGlobalSettings(data, updatedBy);
    return settingsRepository.getGlobalSettings();
  }

  async getOperatingHours(
    userId: string
  ): Promise<{ start: string; end: string }> {
    const settings = await this.getSettings(userId);
    return settings.operatingHours;
  }

  async getDefaultMaxTime(userId: string): Promise<number> {
    const settings = await this.getSettings(userId);
    return settings.defaultMaxTimePerDay;
  }

  async getTimeSlotDuration(userId: string): Promise<number> {
    const settings = await this.getSettings(userId);
    return settings.timeSlotDuration;
  }
}

export const settingsService = SettingsService.getInstance();
