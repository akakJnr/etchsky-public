// A private id kept in this browser so the visitor's own stars show up as theirs.
// The real registry replaces this with the visitor's account.
export function keeperId(): string {
  try {
    let id = localStorage.getItem('etchsky.keeper');
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem('etchsky.keeper', id);
    }
    return id;
  } catch {
    return 'anonymous-session';
  }
}
export interface KeptStar {
  number: string;
  idx: number;
  dedication: string;
  keeperName: string;
  createdAt: string;
  mine?: boolean;
}
