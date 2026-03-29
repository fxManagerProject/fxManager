import z from 'zod';
import { API_TOKEN } from '../utils/env';
import { HttpServer } from './class';

const api = new HttpServer(API_TOKEN);

api.post(
  '/drop',
  {
    schema: z.object({
      serverId: z.number(),
      reason: z.string(),
    }),
  },
  ({ body }) => {
    const { serverId, reason } = body;

    DropPlayer(String(serverId), reason);

    return {
      status: 200,
      body: { success: true, data: null },
    };
  },
);
