/**
 * 服务器测试脚本
 * 测试所有API端点是否正常工作
 */

const BASE_URL = 'http://localhost:3000';

// 颜色输出
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function testHealthCheck() {
  log('\n📋 测试 1: 健康检查', 'blue');
  try {
    const response = await fetch(`${BASE_URL}/health`);
    const data = await response.json();
    log(`✓ 状态: ${data.status}`, 'green');
    log(`✓ 运行时间: ${Math.floor(data.uptime)}秒`, 'green');
    return true;
  } catch (error) {
    log(`✗ 错误: ${error.message}`, 'red');
    return false;
  }
}

async function testCreateGame() {
  log('\n📋 测试 2: 创建游戏', 'blue');
  try {
    const response = await fetch(`${BASE_URL}/api/game/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        redPlayer: { type: 'user' },
        blackPlayer: { type: 'ai', model: 'deepseek' }
      })
    });

    const data = await response.json();

    if (data.success) {
      log(`✓ 游戏ID: ${data.data.id}`, 'green');
      log(`✓ 红方: ${data.data.players.red.type}`, 'green');
      log(`✓ 黑方: ${data.data.players.black.type} (${data.data.players.black.model})`, 'green');
      return data.data.id;
    } else {
      log(`✗ 创建失败: ${data.message}`, 'red');
      return null;
    }
  } catch (error) {
    log(`✗ 错误: ${error.message}`, 'red');
    return null;
  }
}

async function testGetGameState(gameId) {
  log('\n📋 测试 3: 获取游戏状态', 'blue');
  try {
    const response = await fetch(`${BASE_URL}/api/game/${gameId}`);
    const data = await response.json();

    if (data.success) {
      log(`✓ 当前回合: ${data.data.turn}`, 'green');
      log(`✓ 游戏状态: ${data.data.status}`, 'green');
      log(`✓ 走法数: ${data.data.moves.length}`, 'green');
      return true;
    } else {
      log(`✗ 获取失败: ${data.message}`, 'red');
      return false;
    }
  } catch (error) {
    log(`✗ 错误: ${error.message}`, 'red');
    return false;
  }
}

async function testMakeMove(gameId) {
  log('\n📋 测试 4: 执行走法', 'blue');
  try {
    const response = await fetch(`${BASE_URL}/api/game/${gameId}/move`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: { x: 1, y: 6 },
        to: { x: 1, y: 5 },
        player: 'red'
      })
    });

    const data = await response.json();

    if (data.success) {
      log(`✓ 走法成功`, 'green');
      if (data.data.move) {
        log(`✓ 移动: (${data.data.move.from.x},${data.data.move.from.y}) -> (${data.data.move.to.x},${data.data.move.to.y})`, 'green');
      }
      if (data.data.aiMove) {
        log(`✓ AI回应: (${data.data.aiMove.from.x},${data.data.aiMove.from.y}) -> (${data.data.aiMove.to.x},${data.data.aiMove.to.y})`, 'green');
      }
      return true;
    } else {
      log(`✗ 走法失败: ${data.message}`, 'red');
      return false;
    }
  } catch (error) {
    log(`✗ 错误: ${error.message}`, 'red');
    return false;
  }
}

async function testGetAllGames() {
  log('\n📋 测试 5: 获取所有游戏', 'blue');
  try {
    const response = await fetch(`${BASE_URL}/api/game`);
    const data = await response.json();

    if (data.success) {
      log(`✓ 游戏数量: ${data.data.count}`, 'green');
      data.data.games.forEach((gameId, index) => {
        log(`  ${index + 1}. ${gameId}`, 'green');
      });
      return true;
    } else {
      log(`✗ 获取失败: ${data.message}`, 'red');
      return false;
    }
  } catch (error) {
    log(`✗ 错误: ${error.message}`, 'red');
    return false;
  }
}

async function testDeleteGame(gameId) {
  log('\n📋 测试 6: 删除游戏', 'blue');
  try {
    const response = await fetch(`${BASE_URL}/api/game/${gameId}`, {
      method: 'DELETE'
    });
    const data = await response.json();

    if (data.success) {
      log(`✓ 游戏已删除`, 'green');
      return true;
    } else {
      log(`✗ 删除失败: ${data.message}`, 'red');
      return false;
    }
  } catch (error) {
    log(`✗ 错误: ${error.message}`, 'red');
    return false;
  }
}

async function runTests() {
  log('╔═══════════════════════════════════════════════════════╗', 'blue');
  log('║           中国象棋游戏服务器 - API测试                ║', 'blue');
  log('╚═══════════════════════════════════════════════════════╝', 'blue');

  const results = [];

  results.push(await testHealthCheck());

  const gameId = await testCreateGame();
  results.push(!!gameId);

  if (gameId) {
    results.push(await testGetGameState(gameId));
    results.push(await testMakeMove(gameId));
    results.push(await testGetAllGames());
    results.push(await testDeleteGame(gameId));
  }

  // 总结
  log('\n╔═══════════════════════════════════════════════════════╗', 'blue');
  log('║                        测试总结                        ║', 'blue');
  log('╚═══════════════════════════════════════════════════════╝', 'blue');

  const passed = results.filter(r => r).length;
  const total = results.length;

  log(`\n通过: ${passed}/${total}`, passed === total ? 'green' : 'yellow');

  if (passed === total) {
    log('\n🎉 所有测试通过!', 'green');
  } else {
    log(`\n⚠️  ${total - passed} 个测试失败`, 'red');
  }
}

// 运行测试
runTests().catch(error => {
  log(`\n✗ 测试运行失败: ${error.message}`, 'red');
  process.exit(1);
});
