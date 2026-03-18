import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';

interface PageSizeSelectorProps {
  pageSize: number;
  setPageSize: (size: number) => void;
  label?: string;
}

const PAGE_SIZE_OPTIONS = [5, 10, 20, 50];

export default function PageSizeSelector({
  pageSize,
  setPageSize,
  label = 'Rows per page',
}: PageSizeSelectorProps) {
  return (
    <div className="flex items-center gap-2">
      <Label className="whitespace-nowrap text-xs text-muted-foreground">{label}</Label>

      <Select value={pageSize.toString()} onValueChange={(v) => setPageSize(Number(v))}>
        <SelectTrigger className="h-8 w-[80px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {PAGE_SIZE_OPTIONS.map((size) => (
            <SelectItem key={size} value={size.toString()}>
              {size}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
