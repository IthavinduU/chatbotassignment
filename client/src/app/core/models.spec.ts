import { ChatRequest, describeRequest, REQUEST_LABELS, RequestType } from './models';

/** Builds a request with sensible defaults, overriding only what a test cares about. */
function makeRequest(changes: Partial<ChatRequest>): ChatRequest {
  return {
    _id: 'r1',
    type: 'joinGroup',
    status: 'pending',
    requesterId: 'u1',
    requesterName: 'user.1',
    reason: null,
    createdAt: '2026-01-01T00:00:00Z',
    ...changes,
  };
}

describe('describeRequest', () => {
  it('describes a join request', () => {
    expect(describeRequest(makeRequest({ type: 'joinGroup', groupName: 'Study Group' })))
      .toBe('user.1 wants to join Study Group');
  });

  it('describes a new chatroom request', () => {
    expect(describeRequest(makeRequest({ type: 'createChannel', name: 'ideas', groupName: 'Study Group' })))
      .toBe('user.1 wants a #ideas chatroom in Study Group');
  });

  it('describes a chatroom deletion request', () => {
    expect(describeRequest(makeRequest({ type: 'deleteChannel', channelName: 'general', groupName: 'Study Group' })))
      .toBe('user.1 wants #general in Study Group deleted');
  });

  it('describes a promotion request', () => {
    expect(describeRequest(makeRequest({ type: 'promoteMember', targetName: 'user2', groupName: 'Study Group' })))
      .toBe('user.1 wants user2 made an admin of Study Group');
  });

  it('has a label for every request type', () => {
    const types: RequestType[] = ['joinGroup', 'leaveGroup', 'createChannel', 'deleteChannel', 'createGroup', 'deleteGroup', 'promoteMember'];
    for (const type of types) expect(REQUEST_LABELS[type]).toBeTruthy();
  });
});