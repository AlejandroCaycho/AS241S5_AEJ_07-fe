# AS241S5_AEJ_07 Frontend

Frontend Angular para consumir el backend reactivo de IA.

## Requisitos

- Node.js 20+
- npm 11+
- Backend activo en `http://localhost:8080`

## Instalacion

```bash
npm install
```

## Ejecucion local

```bash
npm start
```

Angular queda disponible en `http://localhost:4200`.

El proyecto usa `proxy.conf.json` para redirigir `/ia` hacia `http://localhost:8080`, evitando problemas de CORS durante desarrollo local.

## Endpoints consumidos

- `POST /ia/procesar`
- `GET /ia/historial`
- `GET /ia/historial/{source}`

## Estructura

```text
src/app/
  core/
    config/          Configuracion de endpoints
    interceptors/    Manejo centralizado de errores HTTP
  features/
    ia/              Feature desacoplada del dominio IA
      pages/
      services/
  models/            Interfaces alineadas al backend
  shared/            Base para componentes reutilizables
```

## Scripts

```bash
npm start
npm run build
npm test
```
