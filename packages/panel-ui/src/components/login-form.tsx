'use client';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Field, FieldGroup, FieldLabel, FieldSeparator } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { GalleryVerticalEndIcon } from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '@/hooks/use-auth';

export function LoginForm({ className, ...props }: React.ComponentProps<'div'>) {
  const { login } = useAuth();
  const [formData, setData] = useState<{ username: string; password: string }>({
    username: '',
    password: '',
  });
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    login(formData.username, formData.password).catch((err) => setError((err as Error).message));
  }

  return (
    <div className={cn('flex flex-col gap-6', className)} {...props}>
      <form onSubmit={(e) => handleSubmit(e)}>
        <FieldGroup>
          <div className="flex flex-col items-center gap-2 text-center">
            <a href="#" className="flex flex-col items-center gap-2 font-medium">
              <div className="flex size-8 items-center justify-center rounded-md">
                <GalleryVerticalEndIcon className="size-6" />
              </div>
              <span className="sr-only">Acme Inc.</span>
            </a>
            <h1 className="text-xl font-bold">Welcome to Acme Inc.</h1>
          </div>
          <Field>
            <FieldLabel htmlFor="username">Username</FieldLabel>
            <Input
              id="username"
              type="text"
              placeholder="john_doe"
              value={formData.username}
              onChange={(e) => setData((prev) => ({ ...prev, username: e.target.value }))}
              required
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="password">Password</FieldLabel>
            <Input
              id="password"
              type="password"
              placeholder="password"
              value={formData.password}
              onChange={(e) => setData((prev) => ({ ...prev, password: e.target.value }))}
              required
            />
          </Field>
          <Field>
            <Button type="submit">Login</Button>
          </Field>
          <FieldSeparator>Or</FieldSeparator>
          <Field>
            <Button variant="outline" type="button">
              <svg
                role="img"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
                id="Fivem--Streamline-Simple-Icons"
                height="24"
                width="24"
                className="text-primary-foreground"
              >
                <desc>Fivem Streamline Icon: https://streamlinehq.com</desc>
                <title>FiveM</title>
                <path
                  d="M22.4 24h-5.225c-0.117 0 -0.455 -1.127 -1.026 -3.375 -1.982 -6.909 -3.124 -10.946 -3.417 -12.12l3.37 -3.325h0.099c0.454 1.42 2.554 7.676 6.299 18.768ZM12.342 7.084h-0.048a3.382 3.385 0 0 1 -0.098 -0.492v-0.098a102.619 102.715 0 0 1 3.272 -3.275c0.13 0.196 0.196 0.356 0.196 0.491v0.05a140.694 140.826 0 0 1 -3.322 3.324ZM5.994 10.9h-0.05c0.67 -2.12 1.076 -3.209 1.223 -3.275L14.492 0.343c0.08 0 0.258 0.524 0.533 1.562zm1.37 -4.014h-0.05C8.813 2.342 9.612 0.048 9.71 0h4.495v0.05a664.971 664.971 0 0 1 -6.841 6.839Zm-2.69 7.874h-0.05c0.166 -0.798 0.554 -1.418 1.174 -1.855a312.918 313.213 0 0 1 5.71 -5.717h0.05c-0.117 0.672 -0.375 1.175 -0.781 1.52zM1.598 24l-0.098 -0.05c1.399 -4.172 2.148 -6.322 2.248 -6.45l6.74 -6.694v0.05C10.232 11.88 8.974 16.263 6.73 24Z"
                  fill="currentColor"
                  stroke-width="1"
                />
              </svg>
              Authenticate with Cfx.re
            </Button>
          </Field>
        </FieldGroup>
      </form>
      <span className="text-red-500 text-center">{error}</span>
    </div>
  );
}
