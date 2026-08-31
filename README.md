# CantusDei Fullstack

Versión backend + frontend de CantusDei, pensada para dejar de depender de `localStorage` y pasar a una base de datos central.

## Tecnología

- Frontend: React + Vite
- Backend: Node.js + Express
- ORM: Prisma
- Base de datos: PostgreSQL
- API: REST

## Estructura

```text
backend/
  prisma/schema.prisma     Modelo de base de datos
  prisma/seed.js           Importa cancioneros actuales y acordes
  src/server.js            Servidor Express
  src/routes/              Rutas API
  src/music.js             Parser de acordes y transposición

frontend/
  src/main.jsx             Aplicación React inicial
  src/api.js               Cliente API
  src/styles.css           Estilos
```

## Tablas principales

- `User`: usuarios y roles.
- `Songbook`: cancioneros, por ejemplo Mayor y Escuela Bíblica.
- `Song`: datos generales de canción.
- `SongVersion`: cada tono/capo de una canción.
- `Chord`: catálogo de acordes y diagramas.
- `SongVersionChord`: acordes usados por cada versión, con conteo.
- `Setlist`: reunión o lista por fecha.
- `SetlistItem`: canciones dentro del setlist.
- `Tutorial`: tutoriales editables.
- `AuditLog`: historial de acciones.

## Instalación local

1. Crear una base PostgreSQL llamada `cantusdei`.

2. Copiar variables:

```bash
cd backend
copy .env.example .env
```

3. Editar `.env` si tu usuario/clave de PostgreSQL son distintos.

4. Instalar dependencias:

```bash
cd backend
npm install
cd ../frontend
npm install
```

5. Crear tablas:

```bash
cd backend
npx prisma migrate dev --name init
```

6. Importar datos actuales:

```bash
npm run seed
```

7. Levantar backend:

```bash
npm run dev
```

8. Levantar frontend:

```bash
cd ../frontend
npm run dev
```

## URLs

- Backend: `http://localhost:4100`
- Health check: `http://localhost:4100/health`
- Frontend: la URL que muestre Vite, normalmente `http://localhost:5173`

## Próximos pasos recomendados

1. Agregar autenticación real con contraseña encriptada.
2. Migrar todas las acciones de edición de la app estática al frontend React.
3. Agregar formularios completos para canciones, versiones y setlists.
4. Crear endpoint de importación masiva desde JSON.
5. Agregar exportación Word/PDF desde backend.
