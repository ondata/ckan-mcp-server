/**
 * DataStore Table Viewer UI Resource
 *
 * Serves the interactive table HTML for MCP Apps clients.
 * URI: ui://ckan/datastore-table
 *
 * The HTML content is inlined so it works in both Node.js and
 * Cloudflare Workers (no fs module available in Workers).
 */

import { registerAppResource, RESOURCE_MIME_TYPE } from "@modelcontextprotocol/ext-apps/server";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export const DATASTORE_TABLE_RESOURCE_URI = "ui://ckan/datastore-table";

// Inline HTML - kept in sync with src/ui/datastore-table.html
const DATASTORE_TABLE_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>DataStore Table Viewer</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: system-ui, -apple-system, sans-serif;
      font-size: 13px;
      background: #fff;
      color: #1a1a1a;
      padding: 12px;
    }
    .header {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 10px;
      flex-wrap: wrap;
    }
    .title { font-size: 14px; font-weight: 600; color: #333; }
    .badge {
      font-size: 11px;
      color: #555;
      background: #f0f0f0;
      border-radius: 10px;
      padding: 2px 8px;
    }
    .controls {
      display: flex;
      gap: 8px;
      margin-bottom: 10px;
      align-items: center;
      flex-wrap: wrap;
    }
    .filter-input {
      flex: 1;
      min-width: 140px;
      max-width: 300px;
      padding: 5px 10px;
      border: 1px solid #d0d0d0;
      border-radius: 4px;
      font-size: 12px;
      outline: none;
    }
    .filter-input:focus { border-color: #0066cc; }
    .page-size-select {
      padding: 5px 8px;
      border: 1px solid #d0d0d0;
      border-radius: 4px;
      font-size: 12px;
      background: #fff;
    }
    .count-info { font-size: 11px; color: #666; margin-left: auto; }
    .table-wrapper {
      overflow-x: auto;
      border: 1px solid #e0e0e0;
      border-radius: 4px;
    }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    th {
      background: #f5f5f5;
      padding: 7px 10px;
      text-align: left;
      font-weight: 600;
      white-space: nowrap;
      cursor: pointer;
      user-select: none;
      border-bottom: 2px solid #e0e0e0;
    }
    th:hover { background: #ebebeb; }
    th.sort-asc::after { content: ' \\25B2'; font-size: 9px; color: #0066cc; }
    th.sort-desc::after { content: ' \\25BC'; font-size: 9px; color: #0066cc; }
    td {
      padding: 5px 10px;
      border-bottom: 1px solid #f0f0f0;
      vertical-align: top;
      max-width: 220px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    tr:hover td { background: #fafafa; }
    tr:last-child td { border-bottom: none; }
    td.null-val { color: #bbb; font-style: italic; }
    td a { color: #0066cc; text-decoration: none; }
    td a:hover { text-decoration: underline; }
    .pagination {
      display: flex;
      align-items: center;
      gap: 3px;
      margin-top: 10px;
      flex-wrap: wrap;
    }
    .page-btn {
      padding: 4px 9px;
      border: 1px solid #d0d0d0;
      border-radius: 3px;
      background: #fff;
      cursor: pointer;
      font-size: 12px;
      line-height: 1.4;
    }
    .page-btn:hover:not(:disabled) { background: #f0f0f0; }
    .page-btn.active { background: #0066cc; color: #fff; border-color: #0066cc; }
    .page-btn:disabled { opacity: 0.4; cursor: default; }
    .ellipsis { padding: 4px 4px; font-size: 12px; color: #999; }
    .notice {
      font-size: 11px;
      color: #888;
      margin-top: 8px;
      padding: 5px 10px;
      background: #fafafa;
      border-left: 3px solid #ddd;
      border-radius: 0 3px 3px 0;
    }
    .state-msg { text-align: center; color: #aaa; padding: 40px 20px; font-size: 13px; }
  </style>
</head>
<body>
  <div id="app"><div class="state-msg">Waiting for data from MCP client&hellip;</div></div>
  <script>
  (function () {
    var allRecords = [], fields = [], total = 0;
    var filteredRecords = [], currentPage = 1, pageSize = 25;
    var sortCol = null, sortDir = 1;
    var filterText = '';
    var colTypes = {};
    function escHtml(s) {
      return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    }
    function range(a, b) { var r=[]; for(var i=a;i<=b;i++) r.push(i); return r; }
    function pagesToShow(cur, tot) {
      if (tot<=7) return range(1,tot);
      if (cur<=4) return range(1,5).concat([tot]);
      if (cur>=tot-3) return [1].concat(range(tot-4,tot));
      return [1,cur-1,cur,cur+1,tot];
    }
    var dateRe = /^\\d{4}-\\d{2}-\\d{2}/;
    function inferType(samples) {
      var numOk=0,dateOk=0,valid=0;
      for(var i=0;i<samples.length;i++){
        var v=samples[i];
        if(v===null||v===undefined||v==='') continue;
        valid++;
        var s=String(v);
        if(s!==''&&!isNaN(Number(s))) numOk++;
        else if(dateRe.test(s)) dateOk++;
      }
      if(valid===0) return 'string';
      if(numOk/valid>0.8) return 'number';
      if(dateOk/valid>0.8) return 'date';
      return 'string';
    }
    function detectColTypes(records,fieldList) {
      var types={};
      for(var i=0;i<fieldList.length;i++){
        var fid=fieldList[i].id;
        var samples=records.slice(0,20).map(function(r){return r[fid];});
        types[fid]=inferType(samples);
      }
      return types;
    }
    function cmpValue(a,b,type){
      if(a===null||a===undefined) return 1;
      if(b===null||b===undefined) return -1;
      if(type==='number') return Number(a)-Number(b);
      if(type==='date') return new Date(a)-new Date(b);
      return String(a).localeCompare(String(b));
    }
    function sortRecords(records){
      if(!sortCol) return records;
      var type=colTypes[sortCol]||'string';
      return records.slice().sort(function(a,b){ return cmpValue(a[sortCol],b[sortCol],type)*sortDir; });
    }
    function applyFilter(records){
      if(!filterText) return records;
      var q=filterText.toLowerCase();
      return records.filter(function(r){
        return fields.some(function(f){
          var v=r[f.id];
          return v!==null&&v!==undefined&&String(v).toLowerCase().indexOf(q)!==-1;
        });
      });
    }
    function getRowLink(rec){
      var raw=rec.__link_url||rec._link_url||rec.url||rec.dataset_url||rec.link;
      if(raw===null||raw===undefined) return null;
      var s=String(raw).trim();
      if(!/^https?:\\/\\//i.test(s)) return null;
      return s;
    }
    function render(){
      var app=document.getElementById('app');
      var _oldFilter=document.getElementById('filter');
      var _saveFocused=!!(_oldFilter&&document.activeElement===_oldFilter);
      var _saveSel=null;
      if(_saveFocused&&_oldFilter){_saveSel=[_oldFilter.selectionStart,_oldFilter.selectionEnd];}
      filteredRecords=sortRecords(applyFilter(allRecords));
      var totalFiltered=filteredRecords.length;
      var totalPages=Math.ceil(totalFiltered/pageSize)||1;
      if(currentPage>totalPages) currentPage=totalPages;
      var start=(currentPage-1)*pageSize;
      var pageRecords=filteredRecords.slice(start,start+pageSize);
      var html='';
      html+='<div class="header">';
      html+='<span class="title">DataStore Table</span>';
      html+='<span class="badge">'+total.toLocaleString()+' total on server</span>';
      if(allRecords.length<total){
        html+='<span class="badge" style="background:#fff3cd;color:#856404">batch: '+allRecords.length.toLocaleString()+'</span>';
      }
      html+='</div>';
      var countLabel=(filterText&&totalFiltered<allRecords.length)
        ?totalFiltered.toLocaleString()+' match'
        :allRecords.length.toLocaleString()+' record'+(allRecords.length!==1?'s':'');
      html+='<div class="controls">';
      html+='<input class="filter-input" id="filter" type="text" placeholder="Filter all columns\\u2026" value="'+escHtml(filterText)+'">';
      html+='<select class="page-size-select" id="pageSz">';
      [10,25,50,100].forEach(function(n){
        html+='<option value="'+n+'"'+(n===pageSize?' selected':'')+'>'+n+' rows</option>';
      });
      html+='</select>';
      html+='<span class="count-info">'+countLabel+'</span></div>';
      var visFields=fields.filter(function(f){return f.id!=='__link_url'&&f.id!=='_link_url';});
      html+='<div class="table-wrapper"><table><thead><tr>';
      visFields.forEach(function(f){
        var cls=(sortCol===f.id)?(sortDir===1?' class="sort-asc"':' class="sort-desc"'):'';
        html+='<th'+cls+' data-col="'+escHtml(f.id)+'">'+escHtml(f.id)+'</th>';
      });
      html+='</tr></thead><tbody>';
      if(pageRecords.length===0){
        html+='<tr><td colspan="'+visFields.length+'" class="state-msg">No records found</td></tr>';
      } else {
        pageRecords.forEach(function(rec){
          html+='<tr>';
          visFields.forEach(function(f){
            var v=rec[f.id];
            if(v===null||v===undefined){
              html+='<td class="null-val">\\u2014</td>';
            } else {
              var s=String(v);
              var display=s.length>80?s.slice(0,77)+'\\u2026':s;
              var link=(f.id==='title')?getRowLink(rec):null;
              if(link){
                html+='<td title="'+escHtml(s)+'"><a href="'+escHtml(link)+'" target="_blank" rel="noopener noreferrer">'+escHtml(display)+'</a></td>';
              } else {
                html+='<td title="'+escHtml(s)+'">'+escHtml(display)+'</td>';
              }
            }
          });
          html+='</tr>';
        });
      }
      html+='</tbody></table></div>';
      if(totalPages>1){
        html+='<div class="pagination">';
        html+='<button class="page-btn" id="prevBtn"'+(currentPage===1?' disabled':'')+'>\\u2039 Prev</button>';
        var pages=pagesToShow(currentPage,totalPages);
        var prev=null;
        pages.forEach(function(p){
          if(prev!==null&&p-prev>1) html+='<span class="ellipsis">\\u2026</span>';
          html+='<button class="page-btn'+(p===currentPage?' active':'')+'" data-page="'+p+'">'+p+'</button>';
          prev=p;
        });
        html+='<button class="page-btn" id="nextBtn"'+(currentPage===totalPages?' disabled':'')+'>Next \\u203a</button>';
        html+='</div>';
      }
      if(total>allRecords.length){
        html+='<div class="notice">Showing batch of '+allRecords.length.toLocaleString()+' records (server total: '+total.toLocaleString()+'). Re-run the tool with a different <code>offset</code> to access more records.</div>';
      }
      app.innerHTML=html;
      bindEvents();
      if(_saveFocused){
        var nf=document.getElementById('filter');
        if(nf){
          nf.focus();
          if(_saveSel)nf.setSelectionRange(_saveSel[0],_saveSel[1]);
        }
      }
    }
    function bindEvents(){
      var filterEl=document.getElementById('filter');
      if(filterEl){
        filterEl.addEventListener('input',function(e){ filterText=e.target.value; currentPage=1; render(); });
      }
      var pageSzEl=document.getElementById('pageSz');
      if(pageSzEl) pageSzEl.addEventListener('change',function(e){ pageSize=parseInt(e.target.value,10); currentPage=1; render(); });
      document.querySelectorAll('th[data-col]').forEach(function(th){
        th.addEventListener('click',function(){
          var col=th.getAttribute('data-col');
          if(sortCol===col){ sortDir=-sortDir; } else { sortCol=col; sortDir=1; }
          render();
        });
      });
      var p=document.getElementById('prevBtn');
      if(p) p.addEventListener('click',function(){ currentPage--; render(); });
      var n=document.getElementById('nextBtn');
      if(n) n.addEventListener('click',function(){ currentPage++; render(); });
      document.querySelectorAll('.page-btn[data-page]').forEach(function(btn){
        btn.addEventListener('click',function(){ currentPage=parseInt(btn.getAttribute('data-page'),10); render(); });
      });
    }
    function initTable(data){
      fields=data.fields||[];
      allRecords=data.records||[];
      total=data.total||allRecords.length;
      colTypes=detectColTypes(allRecords,fields);
      currentPage=1; sortCol=null; sortDir=1; filterText='';
      render();
    }
    // SEP-1865 handshake: host won't send tool-result until initialized
    var _pending={};var _nid=1;
    // Pin the host origin from the initialize response, then only accept messages
    // from it and post back to it (never '*') — postMessage origin hardening.
    var _hostOrigin=null;
    function target(){return _hostOrigin||'*';}
    function mcpReq(method,params){
      var id=_nid++;
      return new Promise(function(res,rej){
        _pending[id]={resolve:res,reject:rej};
        window.parent.postMessage({jsonrpc:'2.0',id:id,method:method,params:params||{}},target());
      });
    }
    function mcpNot(method,params){
      window.parent.postMessage({jsonrpc:'2.0',method:method,params:params||{}},target());
    }
    var _inited=false;
    function sendInited(){if(_inited)return;_inited=true;mcpNot('ui/notifications/initialized');}
    setTimeout(sendInited,1500);
    mcpReq('ui/initialize',{protocolVersion:'2026-01-26',appCapabilities:{},appInfo:{name:'ckan-datastore-table',version:'1.0.0'}})
      .then(sendInited).catch(sendInited);
    window.addEventListener('message',function(event){
      var msg=event.data;
      if(!msg||typeof msg!=='object') return;
      // Reply to a pending request: pin the responder's origin as the trusted host.
      if(msg.id!==undefined&&_pending[msg.id]){
        if(_hostOrigin===null)_hostOrigin=event.origin;
        var r=_pending[msg.id];delete _pending[msg.id];
        if(msg.error)r.reject(new Error(JSON.stringify(msg.error)));else r.resolve(msg.result);
        return;
      }
      // Data-bearing messages must come from the pinned host origin.
      if(_hostOrigin===null||event.origin!==_hostOrigin) return;
      var data=null;
      if(msg.method==='ui/notifications/tool-result'&&msg.params&&msg.params.structuredContent){
        data=msg.params.structuredContent;
      }
      if(!data) data=
        (msg.method==='ui/toolResult'&&msg.params&&msg.params.result&&msg.params.result.structuredContent)||
        msg.structuredContent||
        (msg.fields&&msg.records?msg:null);
      if(data&&(data.fields||data.records)) initTable(data);
    });
  }());
  </script>
</body>
</html>`;

export function registerDatastoreTableUiResource(server: McpServer) {
  registerAppResource(
    server,
    "CKAN DataStore Table Viewer",
    DATASTORE_TABLE_RESOURCE_URI,
    {
      description: "Interactive sortable/filterable/paginated table for CKAN data results (MCP Apps UI)",
    },
    async (uri) => {
      return {
        contents: [
          {
            uri: uri.href,
            mimeType: RESOURCE_MIME_TYPE,
            text: DATASTORE_TABLE_HTML,
          },
        ],
      };
    }
  );
}
