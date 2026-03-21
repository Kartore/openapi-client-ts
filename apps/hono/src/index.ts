import { OpenAPIHono } from '@hono/zod-openapi';

import { handler, route } from './routes/users/:id/index.js';

const app = new OpenAPIHono();

app.openapi(route, handler);

app.doc('/doc', {
  openapi: '3.1.0',
  info: {
    version: '1.0.0',
    title: 'My API',
  },
});

export default app;
