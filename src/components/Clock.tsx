import { useEffect, useState } from 'react';
import { format } from 'date-fns'; // optional: npm install date-fns if you want, otherwise use toLocaleTimeString

export function Clock() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  // If you don't want date-fns, use: now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
  const time = format(now, 'HH:mm:ss');

  return <span className="font-mono text-xs text-slate-200">{time}</span>;
}
