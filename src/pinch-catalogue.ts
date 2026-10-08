import type {MuseumId} from './full-types';
import type {PassageCatalogue} from './pinch-navigation';

const parts=import.meta.glob<PassageCatalogue>('./data/pinch-passages-*.json',{eager:true,import:'default'});
export function pinchPassages(museum:MuseumId):PassageCatalogue{
 return Object.values(parts).find(part=>part.museum===museum)||{museum,scenes:{}};
}
