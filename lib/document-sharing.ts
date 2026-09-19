export type DocumentAccess = 'broker_only' | 'approved' | 'nda_signed';
export const documentFolders = ['Overview','Financial','Tax','Legal','Employees','Customers','Assets','Closing','Operations'] as const;
export function documentFolder(category: string) {
  return documentFolders.includes(category as typeof documentFolders[number]) ? category : 'Overview';
}
export function buyerCanReadDocument(access: DocumentAccess, ndaSigned: boolean, approved: boolean) {
  return access === 'approved' ? ndaSigned && approved : access === 'nda_signed' && ndaSigned;
}
export function suggestedDocumentTitle(filename: string) {
  return filename.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim().slice(0,160);
}
export function secureExternalLink(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password;
  } catch { return false; }
}
