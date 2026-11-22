import { useEffect, useState } from 'react';
import { getPhoto } from './photos';

/** A temporary URL for a stored photo, released when the component unmounts. */
export function useObjectUrl(id: string) {
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    let live = true;
    let made: string | undefined;
    getPhoto(id)
      .then((blob) => {
        if (live && blob) {
          made = URL.createObjectURL(blob);
          setUrl(made);
        }
      })
      .catch(() => undefined);
    return () => {
      live = false;
      if (made) URL.revokeObjectURL(made);
    };
  }, [id]);
  return url;
}
