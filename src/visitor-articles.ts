export interface VisitorArticle {path:string;title:string;paragraphs:string[];images:{src:string;alt:string}[]}
type ArticleMap=Record<string,VisitorArticle>;
/** Cache successful loads and share concurrent requests; failed loads remain retryable. */
export function createArticleLoader(load:()=>Promise<ArticleMap>):()=>Promise<ArticleMap> {
 let pending:Promise<ArticleMap>|undefined;
 return ()=>pending??=(Promise.resolve().then(load).catch(error=>{pending=undefined;throw error;}));
}
// Vite transforms JSON into a JavaScript module; a browser JSON assertion is inappropriate.
export const loadVisitorArticles=createArticleLoader(()=>import('./data/visitor-articles.json').then(module=>module.default));
