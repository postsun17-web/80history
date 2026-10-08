import type {WallCatalogue} from './wall-approach';

const parts=import.meta.glob<WallCatalogue>('./data/wall-approach-*.json',{eager:true,import:'default'});
export const wallCatalogue:WallCatalogue={targets:{},scenes:{}};
for(const part of Object.values(parts)){
 Object.assign(wallCatalogue.targets,part.targets);
 for(const [scene,regions] of Object.entries(part.scenes))wallCatalogue.scenes[scene]=[...(wallCatalogue.scenes[scene]||[]),...regions];
}
