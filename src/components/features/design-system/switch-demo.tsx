'use client';

import { useId, useState } from 'react';

import { Switch } from '@/components/ui/switch';

/** A switch whose state is also written in words, ON or OFF (UX spec section 10 map, "Switch"). */
export function SwitchDemo() {
  const labelId = useId();
  const [on, setOn] = useState(true);
  return (
    <div className="flex items-center gap-s-3">
      <Switch checked={on} onCheckedChange={setOn} aria-labelledby={labelId} />
      <span id={labelId} className="text-body text-ink">
        E-mail alerts: <span className="font-semibold">{on ? 'ON' : 'OFF'}</span>
      </span>
    </div>
  );
}
