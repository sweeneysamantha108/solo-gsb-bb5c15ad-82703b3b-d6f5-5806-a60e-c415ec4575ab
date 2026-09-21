"""核心逻辑自测：python3 backend/tests/test_core.py"""
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))

from app.aligner import align_tokens
from app.analyzer import build_comparison
from app.srt_parser import format_ms, parse_srt
from app.timeline_audit import audit_timeline
from app.tokenizer import tokenize

PASS = 0


def check(name, cond):
    global PASS
    assert cond, f'FAIL: {name}'
    PASS += 1
    print(f'  ok - {name}')


def types_of(result):
    return sorted(i['type'] for i in result['issues'])


# ---- 切词与归一化 ---------------------------------------------------------
toks = [t.text for t in tokenize('Hello, 世界！  HELLO　ＡＢＣ，１２３')]
check('标点/空白被忽略，大小写与全半角归一', toks == ['hello', '世', '界', 'hello', 'abc', '123'])

# ---- SRT 解析 -------------------------------------------------------------
cues = parse_srt(
    '1\n00:00:01,000 --> 00:00:02,500\n<i>你好</i>\n世界\n\n'
    '2\n00:00:03.000 --> 00:00:04.000\n第二行\n')
check('SRT 解析块数', len(cues) == 2)
check('SRT 时间码解析', cues[0].start_ms == 1000 and cues[0].end_ms == 2500)
check('SRT 样式标签清除', cues[0].text == '你好\n世界')
check('时间码格式化', format_ms(3723456) == '01:02:03,456')

# ---- 对齐 -----------------------------------------------------------------
ops = align_tokens(list('今天天气很好'), list('今天天气很好'))
check('完全一致 -> 全部 eq', all(o.kind == 'eq' for o in ops))

ops = align_tokens(list('天气非常'), list('非常天气'))
kinds = [o.kind for o in ops]
check('交换顺序 -> 非全 eq', any(k != 'eq' for k in kinds))

# ---- 换行差异不产生误报（核心诉求） ---------------------------------------
script = '人工智能正在改变我们的世界，从手机到汽车，无处不在。'
srt = ('1\n00:00:01,000 --> 00:00:03,000\n人工智能\n正在改变我们的世界，\n\n'
       '2\n00:00:03,000 --> 00:00:05,000\n从手机到汽车，\n无处不在。\n')
res = build_comparison(parse_srt(srt), script)
check('换行/分块差异零误报', res['issues'] == [])

# ---- 缺词 -----------------------------------------------------------------
res = build_comparison(parse_srt(
    '1\n00:00:01,000 --> 00:00:03,000\n人工智能正在改变世界。\n'),
    '人工智能正在改变我们的世界。')
check('缺词被识别', types_of(res) == ['missing'])
check('缺词内容正确', res['issues'][0]['script_tokens'] == ['我', '们', '的'])
check('缺词带时间码', res['issues'][0]['timecode'] == '00:00:01,000 --> 00:00:03,000')

# ---- 多词 -----------------------------------------------------------------
res = build_comparison(parse_srt(
    '1\n00:00:01,000 --> 00:00:03,000\n感谢收看，我们下期节目再见。\n'),
    '感谢收看，我们下期再见。')
check('多词被识别', types_of(res) == ['extra'])
check('多词内容正确', ''.join(res['issues'][0]['subtitle_tokens']) == '节目')

# ---- 错序 -----------------------------------------------------------------
res = build_comparison(parse_srt(
    '1\n00:00:01,000 --> 00:00:03,000\n首先让我们看看家居智能。\n'),
    '首先让我们看看智能家居。')
check('错序被识别', types_of(res) == ['misorder'])

# ---- 错词（替换） ----------------------------------------------------------
res = build_comparison(parse_srt(
    '1\n00:00:01,000 --> 00:00:03,000\n科技让生活更美妙。\n'),
    '科技让生活更美好。')
check('错词被识别', types_of(res) == ['replace'])

# ---- 跨字幕块的连续差异只报一次（防级联） ----------------------------------
res = build_comparison(parse_srt(
    '1\n00:00:01,000 --> 00:00:02,000\n今天天气非常\n\n'
    '2\n00:00:02,000 --> 00:00:03,000\n不错。\n'),
    '今天非常天气不错。')
check('跨块错序归并为一条', types_of(res) == ['misorder'])

# ---- 混合场景 --------------------------------------------------------------
res = build_comparison(parse_srt(
    '1\n00:00:01,000 --> 00:00:02,000\n各位观众朋友晚上好。\n\n'
    '2\n00:00:02,000 --> 00:00:03,000\n今天聊聊智能的家居。\n\n'
    '3\n00:00:03,000 --> 00:00:04,000\n当你回家，灯光自动亮起。\n\n'
    '4\n00:00:04,000 --> 00:00:05,000\n科技让生活更美妙，感谢收看。\n'),
    '各位观众朋友晚上好。今天聊聊智能家居。当你下班回家时，灯光自动亮起。'
    '科技让生活更美好，感谢收看。')
check('混合场景识别 多词+缺词+错词', types_of(res) == ['extra', 'missing', 'replace'])

# ---- 时间轴审计：重叠 / 空隙 / CPS ----------------------------------------
audit_srt = (
    '1\n00:00:00,000 --> 00:00:02,000\n第一块字幕内容。\n\n'
    # 块 2 与块 1 重叠 200ms
    '2\n00:00:01,800 --> 00:00:03,000\n第二块。\n\n'
    # 块 3 与块 2 相隔 5s，且 14 字 / 0.5s = 28 CPS
    '3\n00:00:08,000 --> 00:00:08,500\n第三块内容也非常多字十二个字\n\n'
    '4\n00:00:08,600 --> 00:00:10,000\n第四块正常显示。\n'
)
audit_cues = parse_srt(audit_srt)
tl = audit_timeline(audit_cues, {'overlap_ms': 1, 'gap_ms': 3000, 'max_cps': 15})
tl_types = [t['type'] for t in tl]
check('审计识别 重叠+空隙+CPS', tl_types == ['overlap', 'gap', 'cps'])
check('重叠值正确', tl[0]['value'] == 200 and tl[0]['cue'] == 0 and tl[0]['cue_end'] == 1)
check('空隙值正确', tl[1]['value'] == 5000 and tl[1]['cue'] == 1)
check('CPS 带建议', '字/秒' in tl[2]['suggestion'] and tl[2]['cue'] == 2)
check('审计问题带时间码', all('-->' in t['timecode'] for t in tl))

# 收紧/放宽阈值可消除或保留问题
check('放宽阈值后无审计问题',
      audit_timeline(audit_cues, {'overlap_ms': 500, 'gap_ms': 6000, 'max_cps': 30}) == [])
check('重叠阈值为 0 时首尾相接不报',
      audit_timeline(parse_srt('1\n00:00:00,000 --> 00:00:01,000\n甲。\n\n'
                               '2\n00:00:01,000 --> 00:00:02,000\n乙。\n'),
                     {'overlap_ms': 0, 'gap_ms': 3000, 'max_cps': 15}) == [])
try:
    audit_timeline(audit_cues, {'overlap_ms': -1, 'gap_ms': 3000, 'max_cps': 15})
    check('负阈值被拒绝', False)
except ValueError:
    check('负阈值被拒绝', True)

# 审计结果进入 build_comparison 输出，文字问题不受影响
script_audit = '第一块字幕内容。第二块。第三块内容也非常多字十二个字第四块正常显示。'
res = build_comparison(audit_cues, script_audit)
check('结果含 timeline_issues 与阈值', len(res['timeline_issues']) == 3 and 'thresholds' in res)
check('审计计数进入 stats', res['stats']['overlap'] == 1 and res['stats']['gap'] == 1
      and res['stats']['cps'] == 1 and res['stats']['timeline_total'] == 3)
check('自定义阈值生效',
      build_comparison(audit_cues, script_audit,
                       {'overlap_ms': 500, 'gap_ms': 6000, 'max_cps': 30})['timeline_issues'] == [])

print(f'\n全部 {PASS} 项断言通过')
