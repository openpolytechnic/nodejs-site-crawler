var textNodes = $('body').find('*').contents().filter(function() { 
  return this.nodeType === 3 });
console.log(textNodes);
term = 'dog';
textNodes.each(function() {
  var $this = $(this);
  var content = $this.text();
  content = content.replace(term, '<span class="highlight">' + term + '</span>');
  $this.replaceWith(content);
});
