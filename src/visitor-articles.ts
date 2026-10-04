export interface VisitorArticle {path:string;title:string;paragraphs:string[];images:{src:string;alt:string}[]}
let pending:Promise<Record<string,VisitorArticle>>|undefined;
export function loadVisitorArticles():Promise<Record<string,VisitorArticle>> {
 return pending??=import('./data/visitor-articles.json',{with:{type:'json'}}).then(module=>module.default);
}
