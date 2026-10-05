import museum from './data/full-museum.json';
import catalogue from './data/content-titles.json';
import {createContentTitles,type TitleCatalogue} from './title-resolver';
import type {FullMuseum} from './full-types';

export const contentTitles=createContentTitles(museum as unknown as FullMuseum,catalogue as TitleCatalogue);
export function titlesForMuseum(data:FullMuseum){
 return data.id==='memorial'?createContentTitles(data,{schemaVersion:1,pages:{},articles:{},images:{},galleries:{}}):contentTitles;
}
