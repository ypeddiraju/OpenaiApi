export function makeJSONBlock(content, emptyText = 'No data') {
    return Array.isArray(content)
        ? !content?.length
            ? emptyText
            : '```json\n' + JSON.stringify(content, null, 4) + '\n```'
        : !content
            ? emptyText
            : '```json\n' + JSON.stringify(content, null, 4) + '\n```';
}
