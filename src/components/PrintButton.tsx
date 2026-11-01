'use client';
export default function PrintButton() {
  return <button className="btn btn-keep" onClick={() => window.print()}>Print certificate</button>;
}
