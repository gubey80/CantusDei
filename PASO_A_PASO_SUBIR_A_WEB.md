# Paso a paso para subir CantusDei a la web

## Arquitectura recomendada

- Base de datos: Supabase Postgres.
- Backend: Render Web Service con Node/Express.
- Frontend: Vercel con React/Vite.
- Dominio principal: `cantusdei.com.ar`.
- Subdominio de API: `api.cantusdei.com.ar`.

Esta separacion permite que todos los musicos trabajen sobre la misma base central: canciones, acordes, setlists, usuarios y recursos.

## 1. Preparar el repositorio

Subi a GitHub la carpeta `outputs/cantusdei-fullstack` como proyecto.

Estructura esperada:

```text
cantusdei-fullstack/
  backend/
  frontend/
  render.yaml
```

No subas archivos `.env` reales. Solo deben quedar los `.env.example`.

## 2. Crear la base en Supabase

1. Crear un proyecto en Supabase.
2. Ir a `Project Settings > Database > Connection string`.
3. Copiar la cadena de conexion PostgreSQL.
4. Usar esa cadena como `DATABASE_URL` en Render.

Para Prisma conviene usar la cadena de conexion compatible con PostgreSQL. Supabase documenta una guia especifica para Prisma y recomienda usar variables de entorno para la conexion.

## 3. Publicar el backend en Render

1. Entrar a Render.
2. Crear `New > Web Service`.
3. Conectar el repositorio de GitHub.
4. Si Render detecta `render.yaml`, puede usar la configuracion del archivo.
5. Si lo haces manualmente:

```text
Root Directory: backend
Build Command: npm install && npx prisma generate
Start Command: npx prisma migrate deploy && npm start
```

Variables de entorno en Render:

```text
DATABASE_URL=postgresql://...
FRONTEND_URL=https://cantusdei.com.ar,https://www.cantusdei.com.ar
NODE_ENV=production
```

Render asigna el puerto automaticamente con la variable `PORT`. El backend de CantusDei ya esta preparado para leerla.

Cuando termine el deploy, Render te dara una URL parecida a:

```text
https://cantusdei-api.onrender.com
```

Proba:

```text
https://cantusdei-api.onrender.com/health
```

Debe responder:

```json
{ "ok": true, "app": "CantusDei" }
```

## 4. Inicializar tablas y datos

El comando de inicio del backend ejecuta:

```text
npx prisma migrate deploy
```

Eso crea o actualiza las tablas.

Para cargar datos iniciales, ejecutar una sola vez desde Render Shell o localmente apuntando a la base remota:

```bash
cd backend
npm run seed
```

Importante: antes de correr `seed`, verificá que `DATABASE_URL` apunte a Supabase y no a tu PostgreSQL local.

## 5. Publicar el frontend en Vercel

1. Entrar a Vercel.
2. Crear `New Project`.
3. Seleccionar el mismo repositorio.
4. Configurar:

```text
Root Directory: frontend
Framework: Vite
Build Command: npm run build
Output Directory: dist
```

Variable de entorno en Vercel:

```text
VITE_API_URL=https://api.cantusdei.com.ar/api
```

Luego desplegar.

## 6. Ajustar CORS

En Render, dejar `FRONTEND_URL` con el dominio final:

```text
FRONTEND_URL=https://cantusdei.com.ar,https://www.cantusdei.com.ar
```

Mientras estas probando, podes permitir tambien la URL temporal de Vercel:

```text
FRONTEND_URL=https://cantusdei.com.ar,https://www.cantusdei.com.ar,https://tu-proyecto.vercel.app
```

## 7. Usuario administrador

El seed actual crea el administrador de prueba usado en local si esta definido en el script.

Despues de publicar, cambiá la contraseña o crea un usuario administrador definitivo desde la seccion de usuarios.

## 8. Configurar el dominio `cantusdei.com.ar`

La configuracion recomendada es:

```text
https://cantusdei.com.ar      Frontend en Vercel
https://www.cantusdei.com.ar  Frontend en Vercel
https://api.cantusdei.com.ar  Backend en Render
```

### En Vercel

1. Ir al proyecto del frontend.
2. Entrar a `Settings > Domains`.
3. Agregar:

```text
cantusdei.com.ar
www.cantusdei.com.ar
```

4. Vercel va a indicar los registros DNS exactos que tenes que crear.

Normalmente Vercel pide:

```text
Tipo A      Nombre @      Valor 76.76.21.21
Tipo CNAME  Nombre www    Valor cname.vercel-dns.com
```

Usa siempre los valores que Vercel muestre en pantalla, porque pueden variar.

### En Render

1. Ir al servicio del backend.
2. Entrar a `Settings > Custom Domains`.
3. Agregar:

```text
api.cantusdei.com.ar
```

4. Render va a indicar el CNAME que tenes que crear.

Normalmente sera algo parecido a:

```text
Tipo CNAME  Nombre api    Valor cantusdei-api.onrender.com
```

Usa siempre el valor exacto que Render muestre.

### En el panel DNS del dominio

Crear los registros que indiquen Vercel y Render.

Ejemplo orientativo:

```text
A      @    76.76.21.21
CNAME  www  cname.vercel-dns.com
CNAME  api  cantusdei-api.onrender.com
```

Despues de cambiar DNS puede tardar desde unos minutos hasta varias horas en propagarse.

## 9. Checklist final

- `https://api.../health` responde OK.
- `https://api.cantusdei.com.ar/health` responde OK.
- `https://cantusdei.com.ar` abre el frontend.
- El frontend abre sin errores.
- Login de administrador funciona.
- Lectura de canciones funciona.
- Crear/editar una cancion funciona.
- Crear/editar acordes funciona.
- Crear setlist funciona.
- Otro usuario desde otra PC ve los mismos datos.

## Fuentes consultadas

- Render: despliegue de apps Node/Express y variables de entorno.
- Vercel: despliegue de Vite y variables de entorno.
- Supabase: uso de Prisma con Supabase Postgres.
