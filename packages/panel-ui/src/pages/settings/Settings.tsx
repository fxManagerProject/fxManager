import { PageHeader } from '@/components/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { SettingsIcon } from 'lucide-react';

export default function Settings() {
  return (
    <div className="space-y-2">
      <PageHeader Icon={SettingsIcon} title="Settings" description="fxManager's general settings" />

      <div className="flex items-center gap-2"></div>
      <Card className="bg-card/50">
        <CardContent className="py-12 text-center text-muted-foreground">
          Server configuration coming soon.
        </CardContent>
      </Card>
    </div>
  );
}
