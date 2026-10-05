import museum from './data/full-museum.json';
import catalogue from './data/content-titles.json';
import {createContentTitles,type TitleCatalogue} from './title-resolver';
import type {FullMuseum} from './full-types';

export const contentTitles=createContentTitles(museum as unknown as FullMuseum,catalogue as TitleCatalogue);
