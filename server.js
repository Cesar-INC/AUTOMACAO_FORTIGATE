require('dotenv').config();
const fs = require('fs');
const path = require('path');
const readLine = require('readline');
const IPFortigate = process.env.IP;
const portaFortigate = process.env.PORTA;
const chave = process.env.API_KEY;
const urlBase = `https://${IPFortigate}:${portaFortigate}`;
const vdom = process.env.VDOM
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
async function lerArquivoMACs() {
    const caminhoMACs = path.normalize(process.env.CAMINHO_MACS);
    const fileStream = fs.createReadStream(caminhoMACs);
    const rl = readLine.createInterface({
        input: fileStream,
        crlfDelay: Infinity
    });
    const arrayMACs = [];
    for await (const linha of rl) {
        if (!linha.trim()) continue;
        const macFormatado = linha.replace(/-/g, ':').toUpperCase();
        const objetoCriado = await adicionarMACAddress(macFormatado);        
        arrayMACs.push(objetoCriado);
    }
    await criarGrupo();
    if(arrayMACs.length > 0){
        alterarGrupo(arrayMACs)
    }
    else{
        console.log("Nenhum MAC válido para processar.");
    }
}

async function adicionarMACAddress(mac) {
    const url = `${urlBase}/api/v2/cmdb/firewall/address?vdom=${vdom}`;
    const nomeMAC = `MAC_ADDRESS_${mac}`;
    const resposta = await fetch(url, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${chave}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            name: nomeMAC,
            type: 'mac',
            macaddr: mac
        })
    });
    const dados = await resposta.json();

    if (resposta.ok) {
        console.log(`Sucesso: ${nomeMAC} criado.`);
        return { nomeMAC: nomeMAC };
    } else if (dados.error === -5) {
        console.log(`Aviso: ${nomeMAC} já existe no Fortigate.`);
        return { nomeMAC: nomeMAC };
    } else {
        console.error(`Erro ao criar ${mac}:`, dados.status);
        return null;
    }
}

async function criarGrupo() {
    const nomeGrupo = process.env.NOME_GRUPO;
    const respostaPost = await fetch(`${urlBase}/api/v2/cmdb/firewall/addrgrp?vdom=${vdom}`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${chave}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            name: nomeGrupo,
            member: []
        })
    });
    if (respostaPost.ok) {
        console.log(`Grupo "${nomeGrupo}" criado com sucesso.`);
    } 
}
async function alterarGrupo(membros) {
    const nomeGrupo = process.env.NOME_GRUPO;
    const membrosDoGrupo = await listarMembrosDoGrupo();
    const nomesMembroGrupo = membrosDoGrupo.map((membro) => {
        return membro.name
    })
    const novosMembrosGrupo = membros.filter((membro) => !nomesMembroGrupo.includes(membro.nomeMAC)).map((membro) => {
        return {name: membro.nomeMAC}
    })
    const respostaPut = await fetch(`${urlBase}/api/v2/cmdb/firewall/addrgrp/${nomeGrupo}?vdom=${vdom}`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${chave}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                member: novosMembrosGrupo
            })
        });

        if (respostaPut.ok) {
            console.log(`Grupo "${nomeGrupo}" atualizado com todos os membros.`);
        } else {
            console.error(await respostaPut.json());
        }
}
async function listarMembrosDoGrupo() {
    const nomeGrupo = process.env.NOME_GRUPO;
    const url = `${urlBase}/api/v2/cmdb/firewall/addrgrp/${nomeGrupo}?vdom=${vdom}`;
    try {
        const resposta = await fetch(url, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${chave}`,
                'Content-Type': 'application/json'
            }
        });

        const dados = await resposta.json();

        if (resposta.ok) {
            const membros = dados.results[0].member;
            return membros;
        } else {
            console.error(`Erro ao buscar grupo: ${dados.status} - ${dados.message || ''}`);
        }
    } catch (erro) {
        console.error("Erro na requisição GET:", erro);
    }
}
lerArquivoMACs();