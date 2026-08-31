import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NgOptimizedImage } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '@core/services/auth.service';
import { AuditoriaService } from '@core/services/auditoria.service';
import { AppConfigService } from '@core/services/app-config.service';
import { BeeMarkComponent, IconComponent } from '@shared/ui';

/** Pantalla de inicio de sesión validada contra la base de datos (RF-AUT-01). */
@Component({
  selector: 'app-login',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, NgOptimizedImage, IconComponent, BeeMarkComponent],
  templateUrl: './login.html',
  styleUrl: './login.css',
})
export class Login {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly auditoria = inject(AuditoriaService);
  protected readonly config = inject(AppConfigService).config;

  protected readonly showPassword = signal(false);
  protected readonly error = signal('');
  protected readonly loading = signal(false);

  protected readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]],
    remember: [true],
  });

  protected togglePassword(): void {
    this.showPassword.update((visible) => !visible);
  }

  protected async submit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.error.set('Ingresa un correo y una contraseña válidos.');
      return;
    }
    this.loading.set(true);
    this.error.set('');
    const { email, password } = this.form.getRawValue();
    const resultado = await this.auth.login(email, password);
    this.loading.set(false);

    if (resultado.ok) {
      this.auditoria.registrar({
        modulo: 'Autenticación',
        accion: 'INICIO_SESION',
        observacion: 'Inició sesión en el aplicativo.',
        entidad: 'usuario',
        referencia: email,
      });
      void this.router.navigate(['/app', 'dashboard']);
      return;
    }

    // No hay sesión, así que el actor se indica a mano. La contraseña tecleada
    // nunca se registra: solo el correo con el que se intentó entrar.
    this.auditoria.registrar({
      modulo: 'Autenticación',
      accion: 'INICIO_SESION_FALLIDO',
      resultado: 'error',
      observacion:
        resultado.motivo === 'servicio'
          ? 'Intento de inicio de sesión fallido: el servicio de autenticación no respondió.'
          : 'Intento de inicio de sesión fallido: credenciales incorrectas.',
      entidad: 'usuario',
      referencia: email,
      detalle: { motivo: resultado.motivo ?? 'credenciales' },
      actor: { nombre: 'Intento no identificado', correo: email },
    });

    this.error.set(
      resultado.motivo === 'servicio'
        ? 'No se pudo contactar con el servicio de autenticación. Intenta de nuevo.'
        : 'Correo o contraseña incorrectos. Verifica tus credenciales.',
    );
  }
}
