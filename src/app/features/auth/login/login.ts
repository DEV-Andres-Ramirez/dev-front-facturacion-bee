import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NgOptimizedImage } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '@core/services/auth.service';
import { AppConfigService } from '@core/services/app-config.service';
import { UserRole } from '@core/models';
import { BeeMarkComponent, IconComponent } from '@shared/ui';

/** Pantalla de inicio de sesión (RF-AUT-01). */
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

  protected readonly form = this.fb.nonNullable.group({
    email: ['viviana.alvarez@beeconsultoria.com', [Validators.required, Validators.email]],
    password: ['acceso-demo', [Validators.required]],
    remember: [true],
  });

  protected readonly quickAccounts: ReadonlyArray<{
    role: UserRole;
    initials: string;
    name: string;
    detail: string;
    avatar: string;
  }> = [
    { role: 'ADMIN', initials: 'VA', name: 'Viviana Álvarez', detail: 'Administrador · Dirección Operativa', avatar: 'av-ink' },
    { role: 'USUARIO', initials: 'CF', name: 'Carolina Forero', detail: 'Usuario · Área Financiera', avatar: 'av-honey' },
  ];

  protected togglePassword(): void {
    this.showPassword.update((visible) => !visible);
  }

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.error.set('Revisa el correo y la contraseña.');
      return;
    }
    const ok = this.auth.loginWithEmail(this.form.controls.email.value);
    if (ok) {
      void this.router.navigate(['/app', 'dashboard']);
    } else {
      this.error.set('No encontramos una cuenta con ese correo corporativo.');
    }
  }

  protected enterAs(role: UserRole): void {
    this.auth.loginAs(role);
    void this.router.navigate(['/app', 'dashboard']);
  }
}
