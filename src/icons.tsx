import type { ReactNode } from "react";

// Pictograms for the panel plates, one per figure, drawn on a 20 unit square.
const ICONS: Record<string, ReactNode> = {
  "01": <><path d="M6 6.5 14 5M6 7l3.5 7M14 6l-3.5 8" /><circle cx="5" cy="6" r="2" /><circle cx="15" cy="5" r="2" /><circle cx="10" cy="15" r="2" /></>,
  "02": <><circle cx="10" cy="6.5" r="3" /><path d="M3.5 17c.6-4 3-5.5 6.5-5.5s5.9 1.5 6.5 5.5" /></>,
  "03": <><path d="M2.5 14a7.5 7.5 0 0 1 15 0M6.5 14a3.5 3.5 0 0 1 7 0" /><path d="M10 14v-1" /></>,
  "04": <><path d="M10 17.5s5-4.8 5-9a5 5 0 0 0-10 0c0 4.2 5 9 5 9Z" /><circle cx="10" cy="8.5" r="1.6" /></>,
  "05": <><path d="M2 10h16M5 7v6M10 5v10M15 7v6" /></>,
  "06": <><path d="M2.5 5h4c3 0 3 5 6 5h5M2.5 15h4c3 0 3-5 6-5" /><path d="m14.5 7 3 3-3 3" /></>,
  "07": <><path d="M3 3v14h14" /><path d="m5.5 13 3.5-4 3 2 4.5-6" /></>,
  "08": <><path d="M4 3v14M16 3v14" /><path d="m4 6 12 7M4 13l12-8" /></>,
  "09": <><rect x="3" y="3" width="5.5" height="5.5" /><rect x="11.5" y="3" width="5.5" height="5.5" /><rect x="3" y="11.5" width="5.5" height="5.5" /><rect x="11.5" y="11.5" width="5.5" height="5.5" /></>,
  "10": <><path d="M3 4.5h14M3 8.2h14M3 11.9h14M3 15.6h14M7.5 4.5v11.1" /></>,
  "11": <><path d="M10 3 18 16.5H2Z" /><path d="M10 8v4.2M10 14.2v.3" /></>,
  "12": <><path d="M5 2.5h7l3.5 3.5v11.5H5Z" /><path d="M12 2.5V6h3.5M7.5 10h5.5M7.5 13h5.5" /></>,
  "13": <><path d="M6.5 5.5h10v11h-10Z" /><path d="M4 14V3h9.5M9 9h5M9 12.5h5" /></>,
  "14": <><path d="M3 6h14M3 14h14" /><circle cx="7" cy="6" r="2" /><circle cx="13" cy="14" r="2" /></>,
  "21": <><path d="M3 5h14M3 10h14M3 15h14M7.5 3v14M12.5 3v14" /></>,
  "22": <><path d="M3 15c3-1 4-8 7-8s4 6 7 5" /><circle cx="3" cy="15" r="1.6" /><circle cx="10" cy="7" r="1.6" /><circle cx="17" cy="12" r="1.6" /></>,
  "23": <><path d="M3 4h8v5H7l-2 2V9H3Z" /><path d="M3 16c4 0 6-3 9-3s3 2 5 1" /></>,
  "24": <><path d="M4 4h7M7 9h9M3 14h6" /><path d="M13 2v16" /></>,
  "25": <><rect x="3" y="3" width="4" height="4" /><circle cx="14" cy="5" r="1.5" /><rect x="10.5" y="11.5" width="5" height="5" /><circle cx="5" cy="14" r="1.5" /></>,
  "26": <><path d="M10 3v14M4 7h6M10 7h5M6 12h4M10 12h7" /></>,
  "28": <><path d="M2.5 10h15M10 6v8" /><circle cx="6" cy="10" r="1.6" /><circle cx="15" cy="10" r="1.6" /></>,
  "29": <><circle cx="4" cy="6" r="1.6" /><circle cx="4" cy="14" r="1.6" /><circle cx="16" cy="10" r="1.6" /><path d="M5.5 6.5 14.5 9.5M5.5 13.5l9-3M4 7.6v4.8" /></>,
  "30": <><path d="M2.5 5h6v4h-3l-2 2V9h-1Z" /><path d="M11.5 11h6v6h-6Z" /><path d="M9 7h3v4" /></>,
  "31": <><path d="M3 4h8M3 7.5h8M3 11h8M3 14.5h5" /><path d="M14 4h3M14 11h3" /></>,
  "32": <><path d="M2 6h6M12 6h6M2 10h5M13 10h5M2 14h6M12 14h6" /><path d="M10 4v12" /></>,
  "33": <><path d="M2 6h16M2 14h16" /><path d="M7 6v8M13 6v8" /></>,
};

export function PanelIcon({ fig }: { fig: string }) {
  return (
    <svg className="panel-icon" viewBox="0 0 20 20" width="20" height="20" aria-hidden="true">
      {ICONS[fig]}
    </svg>
  );
}
