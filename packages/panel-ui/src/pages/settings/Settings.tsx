import { Card, CardContent } from '@/components/ui/card';

export default function Settings() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2"></div>
      <Card className="bg-card/50">
        <CardContent className="py-12 text-center text-muted-foreground">
          Server configuration coming soon.
        </CardContent>
      </Card>
    </div>
  );
}
