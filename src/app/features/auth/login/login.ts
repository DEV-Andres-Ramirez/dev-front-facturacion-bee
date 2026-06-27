import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NgOptimizedImage } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '@core/services/auth.service';
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
    const ok = await this.auth.login(email, password);
    this.loading.set(false);
    if (ok) {
      void this.router.navigate(['/app', 'dashboard']);
    } else {
      this.error.set('Correo o contraseña incorrectos. Verifica tus credenciales.');
    }
  }
}
