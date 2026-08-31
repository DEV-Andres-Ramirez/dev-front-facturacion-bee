import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { BillingDataService } from '@core/services/billing-data.service';
import { UsuariosService } from '@core/services/usuarios.service';
import { AuthService } from '@core/services/auth.service';
import { AuditoriaService } from '@core/services/auditoria.service';
import { EdicionUsuario, NuevoUsuario, User } from '@core/models';
import { BadgeComponent, IconComponent } from '@shared/ui';

interface UsuarioFormValue {
  nombre_usuario: string;
  correo_usuario: string;
  contrasena_usuario: string;
  area_usuario: string;
  rol: string;
  estado: string;
}

/** Gestión de cuentas y matriz de permisos por rol (RF-USR). */
@Component({
  selector: 'app-usuarios',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, BadgeComponent, IconComponent],
  templateUrl: './usuarios.html',
})
export class Usuarios implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly usuarios = inject(UsuariosService);
  private readonly auth = inject(AuthService);
  private readonly auditoria = inject(AuditoriaService);
  protected readonly permissions = inject(BillingDataService).permissions;

  protected readonly users = this.usuarios.users;
  protected readonly loading = this.usuarios.loading;
  protected readonly loadError = this.usuarios.error;
  protected readonly activos = this.usuarios.activos;
  protected readonly administradores = this.usuarios.administradores;
  protected readonly operativos = this.usuarios.operativos;

  protected readonly currentUserId = computed(() => this.auth.user()?.id ?? null);

  protected readonly formOpen = signal(false);
  protected readonly editingId = signal<string | null>(null);
  protected readonly saving = signal(false);
  protected readonly formError = signal('');
  protected readonly actionError = signal('');
  protected readonly isEdit = computed(() => this.editingId() !== null);

  /**
   * Estado de la cuenta antes de editarla. Se guarda al abrir el formulario
   * porque en `save()` el formulario ya contiene solo los valores nuevos y no
   * habría con qué comparar para registrar qué cambió realmente.
   */
  private readonly estadoPrevio = signal<Record<string, string> | null>(null);

  protected readonly form = this.fb.nonNullable.group({
    nombre_usuario: ['', [Validators.required]],
    correo_usuario: ['', [Validators.required, Validators.email]],
    contrasena_usuario: ['', [Validators.required]],
    area_usuario: ['Facturación', [Validators.required]],
    rol: ['USUARIO', [Validators.required]],
    estado: ['activa', [Validators.required]],
  });

  ngOnInit(): void {
    void this.usuarios.load();
  }

  protected openCreate(): void {
    this.formError.set('');
    this.editingId.set(null);
    this.form.reset({
      nombre_usuario: '',
      correo_usuario: '',
      contrasena_usuario: '',
      area_usuario: 'Facturación',
      rol: 'USUARIO',
      estado: 'activa',
    });
    this.setPasswordRequired(true);
    this.formOpen.set(true);
  }

  protected openEdit(user: User): void {
    const row = this.usuarios.byId(user.id);
    if (!row) return;
    this.formError.set('');
    this.editingId.set(row.id_usuario);
    this.form.reset({
      nombre_usuario: row.nombre_usuario,
      correo_usuario: row.correo_usuario,
      contrasena_usuario: '',
      area_usuario: row.area_usuario,
      rol: row.admin_usuario ? 'ADMIN' : 'USUARIO',
      estado: row.estado_usuario ? 'activa' : 'inactiva',
    });
    this.setPasswordRequired(false);
    this.estadoPrevio.set({
      nombre: row.nombre_usuario,
      correo: row.correo_usuario,
      area: row.area_usuario,
      rol: row.admin_usuario ? 'ADMIN' : 'USUARIO',
      estado: row.estado_usuario ? 'activa' : 'inactiva',
    });
    this.formOpen.set(true);
  }

  protected closeForm(): void {
    this.formOpen.set(false);
    this.formError.set('');
  }

  protected async save(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.formError.set('Completa los campos obligatorios.');
      return;
    }
    this.saving.set(true);
    this.formError.set('');
    const v = this.form.getRawValue();
    const editId = this.editingId();

    const result = editId
      ? await this.usuarios.update(editId, this.buildEdit(v))
      : await this.usuarios.create(this.buildNew(v));

    this.saving.set(false);

    const previo = this.estadoPrevio();
    const nuevo = {
      nombre: v.nombre_usuario,
      correo: v.correo_usuario,
      area: v.area_usuario,
      rol: v.rol,
      estado: v.estado,
    };
    const cambios = previo
      ? Object.keys(nuevo).filter((k) => previo[k] !== nuevo[k as keyof typeof nuevo])
      : [];

    this.auditoria.registrar({
      modulo: 'Usuarios',
      accion: editId ? 'ACTUALIZAR_USUARIO' : 'CREAR_USUARIO',
      resultado: result.ok ? 'exito' : 'error',
      observacion: result.ok
        ? editId
          ? `Actualizó la cuenta de ${v.nombre_usuario}${cambios.length ? ` (cambió: ${cambios.join(', ')})` : ''}.`
          : `Creó la cuenta de ${v.nombre_usuario} con rol ${v.rol}.`
        : `No se pudo ${editId ? 'actualizar' : 'crear'} la cuenta de ${v.nombre_usuario}.`,
      entidad: 'usuario',
      referencia: v.correo_usuario,
      // La contraseña nunca se registra: solo si se cambió o no.
      detalle: {
        rol: v.rol,
        area: v.area_usuario,
        estado: v.estado,
        contrasenaCambiada: Boolean(v.contrasena_usuario),
        ...(editId ? { cambios } : {}),
      },
    });

    if (result.ok) {
      this.formOpen.set(false);
      this.estadoPrevio.set(null);
    } else {
      this.formError.set(result.error ?? 'No se pudo guardar.');
    }
  }

  protected async toggleEstado(user: User): Promise<void> {
    if (user.id === this.currentUserId()) {
      // Hasta ahora este rechazo era mudo; en una bitácora es justo el tipo de
      // intento que interesa poder revisar después.
      this.auditoria.registrar({
        modulo: 'Usuarios',
        accion: 'DESHABILITAR_USUARIO',
        resultado: 'advertencia',
        observacion: 'Intentó deshabilitar su propia cuenta; el sistema lo impidió.',
        entidad: 'usuario',
        referencia: user.email,
      });
      return;
    }

    this.actionError.set('');
    const habilitar = user.status !== 'Activa';
    const result = await this.usuarios.setEstado(user.id, habilitar);

    this.auditoria.registrar({
      modulo: 'Usuarios',
      accion: habilitar ? 'HABILITAR_USUARIO' : 'DESHABILITAR_USUARIO',
      resultado: result.ok ? 'exito' : 'error',
      observacion: result.ok
        ? `${habilitar ? 'Habilitó' : 'Deshabilitó'} la cuenta de ${user.name}.`
        : `No se pudo ${habilitar ? 'habilitar' : 'deshabilitar'} la cuenta de ${user.name}.`,
      entidad: 'usuario',
      referencia: user.email,
      detalle: { estadoAnterior: user.status, estadoNuevo: habilitar ? 'Activa' : 'Inactiva' },
    });

    if (!result.ok) this.actionError.set(result.error ?? 'No se pudo cambiar el estado.');
  }

  private buildNew(v: UsuarioFormValue): NuevoUsuario {
    return {
      nombre_usuario: v.nombre_usuario.trim(),
      correo_usuario: v.correo_usuario.trim(),
      contrasena_usuario: v.contrasena_usuario,
      area_usuario: v.area_usuario.trim(),
      admin_usuario: v.rol === 'ADMIN',
      estado_usuario: v.estado === 'activa',
    };
  }

  private buildEdit(v: UsuarioFormValue): EdicionUsuario {
    const edit: EdicionUsuario = {
      nombre_usuario: v.nombre_usuario.trim(),
      correo_usuario: v.correo_usuario.trim(),
      area_usuario: v.area_usuario.trim(),
      admin_usuario: v.rol === 'ADMIN',
      estado_usuario: v.estado === 'activa',
    };
    return v.contrasena_usuario ? { ...edit, contrasena_usuario: v.contrasena_usuario } : edit;
  }

  private setPasswordRequired(required: boolean): void {
    const control = this.form.controls.contrasena_usuario;
    control.setValidators(required ? [Validators.required] : []);
    control.updateValueAndValidity();
  }
}
