import React from 'react';
import { X, BookOpen, Layers, Settings, HelpCircle, CheckCircle, AlertTriangle } from 'lucide-react';

export const CN_TOPICS = {
  subnetting: {
    title: 'IPv4 Subnetting & CIDR',
    layer: 'Layer 3 (Network Layer)',
    purpose: 'Divides large IP address spaces into smaller, isolated logical subnetworks to reduce broadcast traffic and optimize address allocation.',
    process: 'Uses prefix length (/24 = 24 bits network, 8 bits host) to compute Network Address (all host bits 0) and Directed Broadcast Address (all host bits 1). Usable hosts = 2^(32-prefix) - 2.',
    failureCase: 'If two hosts have mismatched subnet masks or reside on different subnets without a default gateway, ARP broadcasts will not cross boundaries and packets are dropped at the source.',
    vivaQuestions: [
      'Why are 2 addresses subtracted when calculating usable hosts in an IPv4 subnet?',
      'What is the difference between classful addressing and Classless Inter-Domain Routing (CIDR)?',
      'Can two devices with the same IP communicate on the same local broadcast domain?'
    ]
  },
  routing: {
    title: 'Dijkstra & Next-Hop Routing Tables',
    layer: 'Layer 3 (Network Layer)',
    purpose: 'Enables routers to make forwarding decisions by inspecting Destination IP and choosing the optimal outgoing interface and next-hop router.',
    process: 'Directly connected interfaces form initial connected routes. Remote networks are discovered via shortest path algorithms (e.g. OSPF Dijkstra) based on accumulated link metrics/costs.',
    failureCase: 'If a link in the active route goes down and no redundant alternate route exists in the routing table, the router generates an ICMP Destination Network Unreachable message.',
    vivaQuestions: [
      'What is the computational complexity of Dijkstra’s algorithm in link-state routing?',
      'How does a router differentiate between a directly connected route and a learned static/dynamic route?',
      'What happens when a packet arrives with a destination IP that matches no entry in the routing table?'
    ]
  },
  ping: {
    title: 'ICMP Echo (Ping) & Reachability',
    layer: 'Layer 3 (Internet Control Message Protocol)',
    purpose: 'Tests end-to-end IP reachability and measures Round-Trip Time (RTT) between two network interfaces.',
    process: 'Source sends an ICMP Echo Request (Type 8). If the target is alive and reachable, it responds with an ICMP Echo Reply (Type 0). Each probe tracks latency and decrements TTL.',
    failureCase: 'Returns "Request timed out" when intermediate links fail, or "Destination Host Unreachable" when the default gateway cannot resolve the target via ARP.',
    vivaQuestions: [
      'Does Ping operate on TCP or UDP? (Answer: Neither; it runs directly over IP via ICMP protocol 1).',
      'What does TTL signify in an ICMP probe?',
      'What causes packet loss during a ping sequence?'
    ]
  },
  traceroute: {
    title: 'Traceroute & TTL Hop Limit',
    layer: 'Layer 3 (Network Layer)',
    purpose: 'Discovers each intermediate router/hop along the path toward a destination IP.',
    process: 'Sends probes with incrementing TTL values (TTL=1, 2, 3...). Each intermediate router decrements TTL to 0, drops the packet, and sends back an ICMP Time Exceeded (Type 11) message identifying itself.',
    failureCase: 'Intermediate routers that filter ICMP or severed links appear as asterisks (*) or timeouts in the hop sequence.',
    vivaQuestions: [
      'How does Traceroute force intermediate routers to reveal their IP addresses?',
      'What is the difference between Windows tracert (uses ICMP) and Linux traceroute (traditionally uses UDP)?',
      'Can a path take different routes on return? (Answer: Yes, routing can be asymmetric).'
    ]
  },
  stp: {
    title: 'Spanning Tree Protocol (IEEE 802.1D)',
    layer: 'Layer 2 (Data Link Layer)',
    purpose: 'Prevents catastrophic Layer 2 switching loops and broadcast storms while preserving physical cable redundancy.',
    process: 'Switches elect a Root Bridge (lowest Bridge ID = Priority + MAC). Every other switch identifies its Root Port (lowest cost to root) and Designated Ports. Redundant loop connections are set to Alternate/Blocking.',
    failureCase: 'Without STP, broadcast frames (like ARP) circulate indefinitely across redundant switch links, creating a broadcast storm that saturates 100% bandwidth and crashes switches within seconds.',
    vivaQuestions: [
      'How does a switch determine which bridge is the Root Bridge in STP?',
      'What are the port states in classic 802.1D STP? (Blocking, Listening, Learning, Forwarding, Disabled).',
      'What is the difference between STP (802.1D) and Rapid STP (802.1w)?'
    ]
  },
  packetFlow: {
    title: 'Encapsulation & L2 MAC / L3 IP Forwarding',
    layer: 'Layers 2, 3, & 4 (OSI Model)',
    purpose: 'Illustrates how data is packaged and forwarded across heterogeneous network boundaries.',
    process: 'End-to-end IP addresses remain constant across routed hops (without NAT). At each router hop, Layer 2 Ethernet headers are stripped, and new Source MAC and Next-Hop Destination MAC are rewritten.',
    failureCase: 'If ARP cannot resolve the next-hop MAC, or if the packet arrives at a router with no route to host, forwarding halts and the frame is discarded.',
    vivaQuestions: [
      'Why do Layer 2 MAC addresses change at every router hop while Layer 3 IP addresses stay constant?',
      'What role does ARP play before an IP packet can be transmitted over an Ethernet link?',
      'What is the difference between the 3-Way Handshake in TCP vs connectionless UDP?'
    ]
  },
  vlans: {
    title: 'VLANs & Inter-VLAN Routing (802.1Q)',
    layer: 'Layer 2 (Data Link) & Layer 3 (Network)',
    purpose: 'Partitions a physical switch into multiple isolated broadcast domains (VLANs). Inter-VLAN communication requires a Layer 3 Router/Gateway.',
    process: 'Access ports tag untagged traffic into a single VLAN. Trunk ports carry multiple VLANs simultaneously using IEEE 802.1Q 4-byte tags. Routers forward packets between subnets across sub-interfaces.',
    failureCase: 'Devices on different VLANs plugged into access ports cannot talk to each other without a router, even if they share the same physical switch.',
    vivaQuestions: [
      'What is an 802.1Q trunk port and why is it used?',
      'What is "Router-on-a-stick" in computer networking?',
      'What security and performance benefits do VLANs provide?'
    ]
  }
};

const LearnConceptModal = ({ topicKey, onClose }) => {
  if (!topicKey || !CN_TOPICS[topicKey]) return null;
  const topic = CN_TOPICS[topicKey];

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider">{topic.layer}</span>
              <h3 className="text-lg font-bold text-slate-900">{topic.title}</h3>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="overflow-y-auto space-y-4 py-4 text-xs pr-1">
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80">
            <h4 className="font-bold text-slate-800 uppercase text-[11px] mb-1 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-blue-600" />
              1. Fundamental Purpose
            </h4>
            <p className="text-slate-600 leading-relaxed">{topic.purpose}</p>
          </div>

          <div className="p-3.5 bg-indigo-50/60 rounded-xl border border-indigo-100">
            <h4 className="font-bold text-indigo-950 uppercase text-[11px] mb-1 flex items-center gap-1.5">
              <Settings className="w-3.5 h-3.5 text-indigo-600" />
              2. Protocol Mechanics & Operation
            </h4>
            <p className="text-indigo-900/90 leading-relaxed">{topic.process}</p>
          </div>

          <div className="p-3.5 bg-amber-50/70 rounded-xl border border-amber-200/80">
            <h4 className="font-bold text-amber-900 uppercase text-[11px] mb-1 flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
              3. Failure Case & Misconfigurations
            </h4>
            <p className="text-amber-800 leading-relaxed">{topic.failureCase}</p>
          </div>

          <div className="p-3.5 bg-blue-50/50 rounded-xl border border-blue-100">
            <h4 className="font-bold text-blue-950 uppercase text-[11px] mb-2 flex items-center gap-1.5">
              <HelpCircle className="w-3.5 h-3.5 text-blue-600" />
              4. Common College Viva Questions
            </h4>
            <ul className="space-y-1.5 list-disc list-inside text-slate-700">
              {topic.vivaQuestions.map((q, idx) => (
                <li key={idx} className="leading-relaxed">{q}</li>
              ))}
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-slate-100 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-lg shadow-xs transition-colors"
          >
            Got It, Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default LearnConceptModal;
