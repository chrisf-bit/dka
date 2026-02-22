import { QRCodeSVG } from 'qrcode.react';
import { useRef, useEffect } from 'react';
import gsap from 'gsap';

interface Props {
  url: string;
}

export default function QRCodeDisplay({ url }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (ref.current) {
      gsap.fromTo(
        ref.current,
        { scale: 0.5, opacity: 0 },
        { scale: 1, opacity: 1, duration: 0.6, ease: 'back.out(1.7)' },
      );
    }
  }, [url]);

  if (!url) return null;

  return (
    <div ref={ref} className="bg-white p-3 rounded-xl inline-block">
      <QRCodeSVG value={url} size={180} level="M" />
    </div>
  );
}
