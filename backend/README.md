# Backend CantusDei

API Express con Prisma. Este backend guarda canciones, versiones, acordes, setlists, usuarios y recursos en PostgreSQL.

## Comandos

```bash
npm install
npx prisma migrate dev --name init
npm run seed
npm run dev
```

## Endpoints iniciales

- `GET /health`
- `GET /api/songs`
- `POST /api/songs`
- `GET /api/songs/:id`
- `POST /api/songs/:id/versions`
- `PUT /api/songs/versions/:versionId`
- `DELETE /api/songs/versions/:versionId`
- `GET /api/chords`
- `POST /api/chords`
- `GET /api/chords/usage`
- `GET /api/setlists`
- `POST /api/setlists`
- `GET /api/tutorials`
- `POST /api/tutorials`
- `GET /api/users`
- `POST /api/users`
