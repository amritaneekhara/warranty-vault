export async function GET(request: Request) {
  const url = new URL(request.url);
  return Response.json(
    {
      name: 'Warranty Vault',
      description:
        'MCP tools for managing warranty records and supporting documents.',
      transport: {
        type: 'streamable-http',
        url: `${url.origin}/mcp`,
      },
    },
  );
}
