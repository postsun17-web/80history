import type {Route} from './navigation';
export class VisitMemory {
 private visits=new Map<string,Route>();
 save(key:string,route:Route,look:Route['look']){this.visits.set(key,{...route,look:look?[...look]:route.look});}
 restore(key:string,fallback:Route):Route{return this.visits.get(key)||fallback;}
}
