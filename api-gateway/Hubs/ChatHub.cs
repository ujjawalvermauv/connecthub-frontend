using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;

namespace YourNamespace.Hubs
{
    [Authorize]
    public class ChatHub : Hub
    {
        private readonly ILogger<ChatHub> _logger;
        public ChatHub(ILogger<ChatHub> logger)
        {
            _logger = logger;
        }

        public override Task OnConnectedAsync()
        {
            _logger.LogInformation("ChatHub OnConnected: ConnectionId={ConnectionId}, User={User}", Context.ConnectionId, Context.User?.Identity?.Name);
            return base.OnConnectedAsync();
        }

        public override Task OnDisconnectedAsync(Exception? exception)
        {
            _logger.LogInformation("ChatHub OnDisconnected: ConnectionId={ConnectionId}, Exception={Exception}", Context.ConnectionId, exception?.Message);
            return base.OnDisconnectedAsync(exception);
        }

        public async Task SendDirectMessage(string receiverUserId, string content)
        {
            _logger.LogDebug("SendDirectMessage from {Sender} to {Receiver}", Context.UserIdentifier, receiverUserId);
            await Clients.User(receiverUserId).SendAsync("ReceiveMessage", new { From = Context.UserIdentifier, Content = content, Timestamp = DateTime.UtcNow });
        }
    }
}
