using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace ConnectHub.Api.Controllers
{
    [ApiController]
    [Route("api/messages")]
    [Authorize]
    public class MessagesController : ControllerBase
    {
        private readonly DbContext _context;

        public MessagesController(DbContext context)
        {
            _context = context;
        }

        [HttpGet("recent")]
        public async Task<ActionResult<IEnumerable<RecentChatDto>>> GetRecentChats()
        {
            var currentUserId = GetCurrentUserId();
            if (!currentUserId.HasValue)
            {
                return Unauthorized();
            }

            var currentUser = currentUserId.Value;

            // 1) Fetch relevant messages first and materialize to avoid complex EF translations
            var messages = await _context.Set<Message>()
                .Where(m => m.SenderId == currentUser || m.ReceiverId == currentUser)
                .OrderByDescending(m => m.CreatedAt)
                .ToListAsync();

            // 2) Group in memory by partner id (other participant)
            var grouped = messages
                .GroupBy(m => m.SenderId == currentUser ? m.ReceiverId : m.SenderId)
                .Select(g => new
                {
                    PartnerId = g.Key,
                    LastMessage = g.First(), // messages are ordered desc so First() is latest
                    UnreadCount = g.Count(x => x.ReceiverId == currentUser && !x.IsRead)
                })
                .OrderByDescending(x => x.LastMessage.CreatedAt)
                .ToList();

            // 3) Load partner user details in a single query
            var partnerIds = grouped.Select(g => g.PartnerId).ToList();
            var users = await _context.Set<User>()
                .Where(u => partnerIds.Contains(u.Id))
                .ToListAsync();

            // 4) Build DTOs
            var recentChats = grouped.Select(g =>
            {
                var user = users.FirstOrDefault(u => u.Id == g.PartnerId) ?? new User { Id = g.PartnerId, UserName = $"user{g.PartnerId}" };
                return new RecentChatDto
                {
                    User = new RecentUserDto
                    {
                        UserId = user.Id,
                        UserName = user.UserName,
                        DisplayName = user.DisplayName
                    },
                    LastMessage = new RecentChatMessageDto
                    {
                        Content = g.LastMessage.Content,
                        CreatedAt = g.LastMessage.CreatedAt
                    },
                    UnreadCount = g.UnreadCount
                };
            }).ToList();

            return Ok(recentChats);
        }

        private int? GetCurrentUserId()
        {
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value
                              ?? User.FindFirst("sub")?.Value;

            return int.TryParse(userIdClaim, out var parsedId) ? parsedId : (int?)null;
        }

        private class RecentChatDto
        {
            public RecentUserDto User { get; set; } = default!;
            public RecentChatMessageDto LastMessage { get; set; } = default!;
            public int UnreadCount { get; set; }
        }

        private class RecentUserDto
        {
            public int UserId { get; set; }
            public string UserName { get; set; } = string.Empty;
            public string? DisplayName { get; set; }
        }

        private class RecentChatMessageDto
        {
            public string Content { get; set; } = string.Empty;
            public DateTime CreatedAt { get; set; }
        }
    }

    public class Message
    {
        public int Id { get; set; }
        public int SenderId { get; set; }
        public int ReceiverId { get; set; }
        public string Content { get; set; } = string.Empty;
        public DateTime CreatedAt { get; set; }
        public bool IsRead { get; set; }
    }

    public class User
    {
        public int Id { get; set; }
        public string UserName { get; set; } = string.Empty;
        public string? DisplayName { get; set; }
    }
}
