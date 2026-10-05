import { isPersonalProvider, type PersonalProviderName } from '../personalProviders';
import { InvalidPersonalProviderCredentialsError } from '../errors/InvalidPersonalProviderCredentialsError';

export class PersonalProviderCredentials {
  private constructor(private readonly provider: PersonalProviderName, private readonly apiKey: string,
    private readonly model: string, private readonly sender: string) {}

  public static create(provider: string, apiKey: string, model: string, sender: string, authorized: boolean): PersonalProviderCredentials {
    if (!isPersonalProvider(provider)) throw new InvalidPersonalProviderCredentialsError('Proveedor no compatible.');
    if (!authorized) throw new InvalidPersonalProviderCredentialsError('Autoriza el uso de tu servicio externo para conectar.');
    const key = apiKey.trim();
    if (key.length < 16 || key.length > 4096 || /\s/.test(key)) throw new InvalidPersonalProviderCredentialsError('Introduce una clave válida del proveedor.');
    const selectedModel = model.trim();
    const from = sender.trim();
    if (provider === 'resend') {
      if (!key.startsWith('re_') || !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(from)) throw new InvalidPersonalProviderCredentialsError('Resend requiere una clave re_… y un correo remitente de tu dominio verificado.');
    } else {
      if (!key.startsWith(provider === 'openai' ? 'sk-' : 'sk-ant-')) throw new InvalidPersonalProviderCredentialsError('La clave no corresponde al proveedor elegido.');
      if (!/^[a-zA-Z0-9][a-zA-Z0-9._:-]{1,119}$/.test(selectedModel)) throw new InvalidPersonalProviderCredentialsError('Introduce el ID de un modelo disponible en tu cuenta.');
    }
    return new PersonalProviderCredentials(provider, key, provider === 'resend' ? '' : selectedModel, provider === 'resend' ? from : '');
  }
  public isAi(): boolean { return this.provider !== 'resend'; }
  public toPrimitives(): { provider: PersonalProviderName; api_key: string; model: string; sender: string; authorized: string } {
    return { provider: this.provider, api_key: this.apiKey, model: this.model, sender: this.sender, authorized: 'true' };
  }
}
